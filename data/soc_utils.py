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

    if '.' in code:
        return code

    if '-' in code:
        return f"{code}.00"

    if len(code) == 6 and code.isdigit():
        return f"{code[:2]}-{code[2:6]}.00"

    return None


def normalize_soc_code_batch(codes):
    """Normalize a list of SOC codes."""
    return [normalize_soc_code(c) for c in codes]
