"""Check the Elexon contract this app depends on against the official OpenAPI spec.
    python scripts/check_contract.py
Prints every parameter (with documented range limits) of the two endpoints we call, and flags mismatches."""
import json
import urllib.request

SPEC = "https://data.elexon.co.uk/swagger/v1/swagger.json"
USED = {
    "/datasets/FUELHH/stream": {"settlementDateFrom", "settlementDateTo", "fuelType"},
    "/datasets/WINDFOR/stream": {"publishDateTimeFrom", "publishDateTimeTo"},
}


def check(spec):
    ok = True
    for path, used in USED.items():
        op = spec.get("paths", {}).get(path, {}).get("get")
        if not op:
            print(f"\nMISSING endpoint {path}")
            ok = False
            continue
        params = {p["name"]: p for p in op.get("parameters", [])}
        print(f"\n{path}: {op.get('summary')}")
        for name, p in params.items():
            sch = p.get("schema", {})
            limits = {k: v for k, v in sch.items() if k.startswith("x-")}
            print(f"  {name:24} required={p.get('required', False)!s:5} {sch.get('format', '')} {limits or ''}")
        if used - set(params):
            print("  !! used by this app but not in the spec:", sorted(used - set(params)))
            ok = False
        required = {n for n, p in params.items() if p.get("required")}
        if required - used:
            print("  !! required by the spec but not sent by this app:", sorted(required - used))
            ok = False
    print("\nCONTRACT OK" if ok else "\nCONTRACT MISMATCH: send this output to Claude")
    return ok


if __name__ == "__main__":
    check(json.load(urllib.request.urlopen(SPEC, timeout=120)))
