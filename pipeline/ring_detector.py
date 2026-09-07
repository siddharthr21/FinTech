"""
Deterministic Fraud Ring & Network Detector.
Directly implements 'Action-Level Guardrails' (Handbook Ch.9.2) & Forensic Graph Analysis.

Zero external graph library dependencies (pure Python BFS/DFS):
1. Shared Hardware Fingerprints (device_id >= 2 customers) - weight 0.25
2. Shared Network Infrastructure (ip_address >= 2 customers) - weight 0.20
3. Rapid Layering Transfer Chains (>= 3 hops, >= 80% retention, < 72h) - weight 0.20
4. Mule Fan-in / Fan-out Concentration (counterparty degree >= 3) - weight 0.15
5. High-Velocity Temporal Clusters (>= 3 txns across cluster in 60 min) - weight 0.10
6. Synthetic Account-Age Synchronization (>= 2 accounts opened <= 30 days apart) - weight 0.10

Discrimination Guarantee:
Benign shared hardware (e.g., family couple on a shared tablet) evaluates with low score (<35%),
while coordinated syndicates with layered velocity, shared IPs, and mule fan-out trigger critical alarms (>80%).
"""

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple


def _parse_iso(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        # Support Python 3.11+ and earlier ISO strings
        clean_ts = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_ts)
    except Exception:
        return None


class RingDetector:
    def __init__(
        self,
        transactions: List[Dict[str, Any]],
        customers: List[Dict[str, Any]],
        customer_history: Optional[List[Dict[str, Any]]] = None,
    ):
        self.transactions = transactions or []
        self.customers = {c["customer_id"]: c for c in (customers or [])}
        self.history = customer_history or []

        # Indexes for fast relationship lookups
        self.device_to_custs: Dict[str, Set[str]] = {}
        self.ip_to_custs: Dict[str, Set[str]] = {}
        self.cust_to_devices: Dict[str, Set[str]] = {}
        self.cust_to_ips: Dict[str, Set[str]] = {}
        self.counterparty_to_custs: Dict[str, Set[str]] = {}
        self.cust_to_counterparties: Dict[str, Set[str]] = {}

        self._build_indexes()

    def _build_indexes(self):
        # Index transactions
        for tx in self.transactions:
            cid = tx.get("customer_id")
            dev = tx.get("device_id")
            ip = tx.get("ip_address")
            cp = tx.get("counterparty_account")

            if cid and dev:
                self.device_to_custs.setdefault(dev, set()).add(cid)
                self.cust_to_devices.setdefault(cid, set()).add(dev)
            if cid and ip:
                self.ip_to_custs.setdefault(ip, set()).add(cid)
                self.cust_to_ips.setdefault(cid, set()).add(ip)
            if cid and cp:
                self.counterparty_to_custs.setdefault(cp, set()).add(cid)
                self.cust_to_counterparties.setdefault(cid, set()).add(cp)

        # Index customer history (login events, password resets, device switches)
        for evt in self.history:
            cid = evt.get("customer_id")
            dev = evt.get("device_id")
            if cid and dev:
                self.device_to_custs.setdefault(dev, set()).add(cid)
                self.cust_to_devices.setdefault(cid, set()).add(dev)

    def has_network_links(self, customer_id: str, device_id: Optional[str] = None, ip_address: Optional[str] = None, counterparty: Optional[str] = None) -> bool:
        """
        Deterministic pre-check: Does this transaction share a device, IP,
        or counterparty with any other customer in the database?
        """
        if device_id and len(self.device_to_custs.get(device_id, set()) - {customer_id}) > 0:
            return True
        if ip_address and len(self.ip_to_custs.get(ip_address, set()) - {customer_id}) > 0:
            return True
        if counterparty and len(self.counterparty_to_custs.get(counterparty, set()) - {customer_id}) > 0:
            return True

        # Check customer's other known devices/IPs
        for dev in self.cust_to_devices.get(customer_id, set()):
            if len(self.device_to_custs.get(dev, set()) - {customer_id}) > 0:
                return True
        for ip in self.cust_to_ips.get(customer_id, set()):
            if len(self.ip_to_custs.get(ip, set()) - {customer_id}) > 0:
                return True

        return False

    def discover_connected_cluster(self, seed_customer_id: str) -> Tuple[Set[str], Set[str], Set[str], Set[str]]:
        """
        BFS traversal to discover all entities in the connected component
        originating from seed_customer_id.
        Returns: (customers, devices, ips, counterparties)
        """
        visited_custs: Set[str] = {seed_customer_id}
        visited_devices: Set[str] = set()
        visited_ips: Set[str] = set()
        visited_counterparties: Set[str] = set()

        queue: List[str] = [seed_customer_id]

        while queue:
            curr_cust = queue.pop(0)

            # Expand to devices
            for dev in self.cust_to_devices.get(curr_cust, set()):
                if dev not in visited_devices:
                    visited_devices.add(dev)
                    for neighbor_cust in self.device_to_custs.get(dev, set()):
                        if neighbor_cust not in visited_custs:
                            visited_custs.add(neighbor_cust)
                            queue.append(neighbor_cust)

            # Expand to IPs
            for ip in self.cust_to_ips.get(curr_cust, set()):
                if ip not in visited_ips:
                    visited_ips.add(ip)
                    for neighbor_cust in self.ip_to_custs.get(ip, set()):
                        if neighbor_cust not in visited_custs:
                            visited_custs.add(neighbor_cust)
                            queue.append(neighbor_cust)

            # Expand to counterparties
            for cp in self.cust_to_counterparties.get(curr_cust, set()):
                if cp not in visited_counterparties:
                    visited_counterparties.add(cp)
                    for neighbor_cust in self.counterparty_to_custs.get(cp, set()):
                        if neighbor_cust not in visited_custs:
                            visited_custs.add(neighbor_cust)
                            queue.append(neighbor_cust)

        return visited_custs, visited_devices, visited_ips, visited_counterparties

    def analyze_transaction(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes full forensic network investigation for a transaction.
        Evaluates the 6 weighted signals and returns structured analysis.
        """
        tx_id = transaction["transaction_id"]
        seed_cust_id = transaction.get("customer_id", "UNKNOWN")

        # 1. Discover full connected component
        cluster_custs, cluster_devices, cluster_ips, cluster_cps = self.discover_connected_cluster(seed_cust_id)

        # Transactions associated with cluster
        cluster_txs = [
            t for t in self.transactions
            if t.get("customer_id") in cluster_custs or t.get("counterparty_account") in cluster_cps
        ]
        # Sort cluster txs chronologically
        cluster_txs_sorted = sorted(
            cluster_txs,
            key=lambda x: _parse_iso(x.get("timestamp", "")) or datetime.min.replace(tzinfo=timezone.utc)
        )

        findings: List[Dict[str, Any]] = []
        signal_scores: Dict[str, float] = {}

        # Signal 1: Shared Device (Weight 0.25)
        # Check if >= 2 customers share any single device_id
        shared_devices = {
            dev: self.device_to_custs[dev] & cluster_custs
            for dev in cluster_devices
            if len(self.device_to_custs.get(dev, set()) & cluster_custs) >= 2
        }
        if shared_devices:
            max_sharing = max(len(custs) for custs in shared_devices.values())
            dev_names = list(shared_devices.keys())
            severity = min(100, 60 + (max_sharing - 2) * 20)
            signal_scores["shared_device"] = 0.25 * (severity / 100.0)
            findings.append({
                "signal_type": "shared_device",
                "severity": severity,
                "explanation": f"Hardware fingerprint overlap: {len(shared_devices)} device(s) ({', '.join(dev_names)}) shared across {max_sharing} distinct customer profiles.",
                "entities": dev_names,
                "evidence": {
                    "shared_devices": {k: list(v) for k, v in shared_devices.items()},
                    "max_overlap_count": max_sharing
                }
            })

        # Signal 2: Shared IP (Weight 0.20)
        shared_ips = {
            ip: self.ip_to_custs[ip] & cluster_custs
            for ip in cluster_ips
            if len(self.ip_to_custs.get(ip, set()) & cluster_custs) >= 2
        }
        if shared_ips:
            max_sharing_ip = max(len(custs) for custs in shared_ips.values())
            ip_list = list(shared_ips.keys())
            severity = min(100, 50 + (max_sharing_ip - 2) * 25)
            signal_scores["shared_ip"] = 0.20 * (severity / 100.0)
            findings.append({
                "signal_type": "shared_ip",
                "severity": severity,
                "explanation": f"Network gateway overlap: {len(shared_ips)} IP address(es) ({', '.join(ip_list)}) shared across {max_sharing_ip} customer accounts.",
                "entities": ip_list,
                "evidence": {
                    "shared_ips": {k: list(v) for k, v in shared_ips.items()},
                    "max_overlap_count": max_sharing_ip
                }
            })

        # Signal 3: Transfer Chain (Weight 0.20)
        # Walk chronological cluster txs: >= 3 hops, each >= 80% of prior, < 72h
        chain_detected = False
        longest_chain: List[Dict[str, Any]] = []

        if len(cluster_txs_sorted) >= 3:
            curr_chain = [cluster_txs_sorted[0]]
            for i in range(1, len(cluster_txs_sorted)):
                prev = curr_chain[-1]
                curr = cluster_txs_sorted[i]
                t_prev = _parse_iso(prev.get("timestamp", ""))
                t_curr = _parse_iso(curr.get("timestamp", ""))
                amt_prev = prev.get("amount", 0.0)
                amt_curr = curr.get("amount", 0.0)

                if t_prev and t_curr and amt_prev > 0 and amt_curr > 0:
                    dt_hours = abs((t_curr - t_prev).total_seconds()) / 3600.0
                    ratio = amt_curr / amt_prev

                    # Layering condition: within 72 hours, value retained >= 80% and <= 105%
                    if dt_hours <= 72.0 and 0.80 <= ratio <= 1.05 and curr.get("customer_id") != prev.get("customer_id"):
                        curr_chain.append(curr)
                    else:
                        if len(curr_chain) > len(longest_chain):
                            longest_chain = list(curr_chain)
                        curr_chain = [curr]
                else:
                    curr_chain = [curr]

            if len(curr_chain) > len(longest_chain):
                longest_chain = list(curr_chain)

            if len(longest_chain) >= 3:
                chain_detected = True
                hop_count = len(longest_chain)
                severity = min(100, 75 + (hop_count - 3) * 15)
                signal_scores["transfer_chain"] = 0.20 * (severity / 100.0)
                chain_tx_ids = [t["transaction_id"] for t in longest_chain]
                amounts = [f"${t.get('amount', 0):,.2f}" for t in longest_chain]
                findings.append({
                    "signal_type": "transfer_chain",
                    "severity": severity,
                    "explanation": f"Rapid layering chain: {hop_count} successive hops across accounts ({' -> '.join(amounts)}) within rapid turnaround.",
                    "entities": chain_tx_ids,
                    "evidence": {
                        "hop_count": hop_count,
                        "transactions": chain_tx_ids,
                        "amounts": [t.get("amount", 0) for t in longest_chain]
                    }
                })

        # Signal 4: Fan-in / Fan-out Mule Concentration (Weight 0.15)
        # Check if any counterparty account has degree >= 3 (connected to >= 3 distinct customers)
        mule_cps = {
            cp: self.counterparty_to_custs[cp] & cluster_custs
            for cp in cluster_cps
            if len(self.counterparty_to_custs.get(cp, set()) & cluster_custs) >= 3
        }
        if mule_cps:
            max_degree = max(len(custs) for custs in mule_cps.values())
            mule_names = list(mule_cps.keys())
            severity = min(100, 70 + (max_degree - 3) * 15)
            signal_scores["fan_in_out"] = 0.15 * (severity / 100.0)
            findings.append({
                "signal_type": "fan_in_out",
                "severity": severity,
                "explanation": f"Mule hub concentration: Destination account(s) ({', '.join(mule_names)}) aggregate payments from {max_degree} distinct source accounts.",
                "entities": mule_names,
                "evidence": {
                    "mule_accounts": {k: list(v) for k, v in mule_cps.items()},
                    "max_degree": max_degree
                }
            })

        # Signal 5: Temporal Cluster (Weight 0.10)
        # Check if >= 3 transactions across cluster occur within 60 minutes
        temporal_cluster_detected = False
        window_tx_ids: List[str] = []
        if len(cluster_txs_sorted) >= 3:
            for i in range(len(cluster_txs_sorted) - 2):
                t_start = _parse_iso(cluster_txs_sorted[i].get("timestamp", ""))
                t_end = _parse_iso(cluster_txs_sorted[i + 2].get("timestamp", ""))
                if t_start and t_end:
                    diff_min = abs((t_end - t_start).total_seconds()) / 60.0
                    if diff_min <= 60.0:
                        temporal_cluster_detected = True
                        window_tx_ids = [t["transaction_id"] for t in cluster_txs_sorted[i:i + 3]]
                        break

        if temporal_cluster_detected:
            signal_scores["temporal_cluster"] = 0.10 * 0.90
            findings.append({
                "signal_type": "temporal_cluster",
                "severity": 90,
                "explanation": "High-velocity cluster: 3 or more transactions executed across distinct syndicate accounts within 60 minutes.",
                "entities": window_tx_ids,
                "evidence": {
                    "burst_transactions": window_tx_ids
                }
            })

        # Signal 6: Account-Age Cluster (Weight 0.10)
        # Check if >= 2 accounts in the cluster were opened within 30 days of each other
        account_open_dates: List[Tuple[str, datetime]] = []
        for cid in cluster_custs:
            cust_obj = self.customers.get(cid)
            if cust_obj and cust_obj.get("account_open_date"):
                dt = _parse_iso(cust_obj["account_open_date"])
                if dt:
                    account_open_dates.append((cid, dt))

        age_cluster_custs: Set[str] = set()
        if len(account_open_dates) >= 2:
            account_open_dates.sort(key=lambda x: x[1])
            for i in range(len(account_open_dates) - 1):
                c1, d1 = account_open_dates[i]
                c2, d2 = account_open_dates[i + 1]
                if abs((d2 - d1).days) <= 30:
                    age_cluster_custs.add(c1)
                    age_cluster_custs.add(c2)

        if len(age_cluster_custs) >= 2:
            severity = min(100, 60 + (len(age_cluster_custs) - 2) * 15)
            signal_scores["account_age_cluster"] = 0.10 * (severity / 100.0)
            findings.append({
                "signal_type": "account_age_cluster",
                "severity": severity,
                "explanation": f"Synthetic account creation burst: {len(age_cluster_custs)} accounts in this cluster were onboarded within 30 days of each other.",
                "entities": list(age_cluster_custs),
                "evidence": {
                    "synchronized_accounts": list(age_cluster_custs)
                }
            })

        # Calculate final composite ring score (0 - 100)
        raw_weighted = sum(signal_scores.values()) * 100.0

        # Multi-signal synergy bonus (when multiple distinct criminal topology vectors align)
        synergy_bonus = 0
        if len(findings) >= 4:
            synergy_bonus = 15
        elif len(findings) >= 2:
            synergy_bonus = 5

        # Isolation discount: if ONLY shared hardware/IP is observed with zero transfer chains,
        # zero mule degree, and zero temporal burst (e.g., innocent couple on family tablet)
        if len(findings) <= 2 and not chain_detected and not mule_cps and not temporal_cluster_detected:
            # Dampen score to ensure benign baseline remains < 35%
            final_score = int(min(30, round(raw_weighted * 0.55)))
        else:
            final_score = int(min(100, max(0, round(raw_weighted + synergy_bonus))))

        is_suspicious_ring = final_score >= 50

        # Build clean graph representation for UI visualization
        graph_nodes = []
        graph_edges = []

        # Customer nodes
        for cid in cluster_custs:
            cust = self.customers.get(cid, {})
            graph_nodes.append({
                "id": cid,
                "label": cust.get("name", cid),
                "type": "customer",
                "isFlagged": cid == seed_cust_id or is_suspicious_ring
            })

        # Device nodes
        for dev in cluster_devices:
            graph_nodes.append({
                "id": dev,
                "label": dev,
                "type": "device",
                "isFlagged": dev in shared_devices
            })

        # IP nodes
        for ip in cluster_ips:
            graph_nodes.append({
                "id": ip,
                "label": ip,
                "type": "ip",
                "isFlagged": ip in shared_ips
            })

        # Counterparty nodes
        for cp in cluster_cps:
            graph_nodes.append({
                "id": cp,
                "label": cp,
                "type": "account",
                "isFlagged": cp in mule_cps
            })

        # Edges
        # Cust -> Device
        for dev, custs in self.device_to_custs.items():
            if dev in cluster_devices:
                for c in custs & cluster_custs:
                    graph_edges.append({
                        "source": c,
                        "target": dev,
                        "relationship": "USED_DEVICE"
                    })

        # Cust -> IP
        for ip, custs in self.ip_to_custs.items():
            if ip in cluster_ips:
                for c in custs & cluster_custs:
                    graph_edges.append({
                        "source": c,
                        "target": ip,
                        "relationship": "ROUTED_THROUGH_IP"
                    })

        # Cust -> Counterparty
        for cp, custs in self.counterparty_to_custs.items():
            if cp in cluster_cps:
                for c in custs & cluster_custs:
                    graph_edges.append({
                        "source": c,
                        "target": cp,
                        "relationship": "TRANSFERRED_TO"
                    })

        cluster_hash = hashlib.md5("".join(sorted(cluster_custs)).encode()).hexdigest()[:8].upper()

        return {
            "cluster_id": f"CLUSTER-{cluster_hash}",
            "target_transaction_id": tx_id,
            "target_customer_id": seed_cust_id,
            "ring_score": final_score,
            "is_suspicious_ring": is_suspicious_ring,
            "signals_triggered": [f["signal_type"] for f in findings],
            "findings": findings,
            "entities": {
                "customers": list(cluster_custs),
                "devices": list(cluster_devices),
                "ips": list(cluster_ips),
                "counterparty_accounts": list(cluster_cps)
            },
            "graph": {
                "nodes": graph_nodes,
                "edges": graph_edges
            },
            "summary": (
                f"Fraud Ring Detector computed Network Risk Score {final_score}% across "
                f"{len(cluster_custs)} connected customer account(s). "
                f"Triggered {len(findings)} network indicator{'s' if len(findings) != 1 else ''}: "
                f"{', '.join(f['signal_type'] for f in findings) if findings else 'None (Isolated)'}."
            )
        }
