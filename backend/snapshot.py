"""Fetch the January 2026 data from Elexon once and store it in backend/data/ (then commit the files).
    python snapshot.py     (takes 1-3 minutes; needs internet)
With the snapshot present the app starts instantly and never depends on Elexon at runtime."""
import elexon

A_half, F = elexon.fetch_raw()
elexon.save_snapshot(A_half, F)
A, F2 = elexon.finalize(A_half, F)
print(f"saved {len(A_half)} half-hourly actuals and {len(F)} forecast rows to {elexon.DATA_DIR}")
print(f"-> {len(A)} complete hourly actuals, {F2.startTime.nunique()} forecast target hours")
