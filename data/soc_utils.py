#!/usr/bin/env python3


def normalize_soc_code(code):
    """
    Convert any SOC code format to standard O*NET format (XX-XXXX.00).

    Supported input formats:
      - Compact:      111011
      - Dash:         11-1011
      - O*NET:        11-1011.00

    Output format:
      - O*NET:        11-1011.00

    Returns None for invalid input.
    """
    if not code:
        return None

    code = str(code).strip()

    if not code:
        return None

    # Accept only fully-formed codes matching "XX-XXXX.00"
    if code.endswith('.00') and len(code) == 10:
        if code[0:2].isdigit() and code[3:7].isdigit() and code[2] == '-' and code[7] == '.':
            return code

    # Accept "XX-XXXX" and normalize by appending ".00"
    if code.count('-') == 1 and len(code) == 7:
        parts = code.split('-')
        if parts[0].isdigit() and len(parts[0]) == 2 and parts[1].isdigit() and len(parts[1]) == 4:
            return f"{code}.00"

    # Accept compact form "XXXXXX" and normalize to "XX-XXXX.00"
    if len(code) == 6 and code.isdigit():
        return f"{code[:2]}-{code[2:6]}.00"

    return None


def normalize_soc_code_batch(codes):
    """Normalize a list of SOC codes."""
    return [normalize_soc_code(c) for c in codes]
