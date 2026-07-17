import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from load import parse_epi_family_budgets

XLSX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         'cost-of-living', 'fbc_data_2026.xlsx')


@pytest.fixture(scope='module')
def entries():
    return parse_epi_family_budgets(XLSX_PATH)


def by_area(entries):
    return {e['area']: e for e in entries}


def test_state_level_entry_count(entries):
    states = [e for e in entries if e['area'] != 'United States']
    assert len(states) == 51  # 50 states + DC


def test_national_baseline_is_100(entries):
    national = by_area(entries)['United States']
    assert national['col_index'] == 100.0


def test_expected_state_ordering(entries):
    data = by_area(entries)
    assert data['HI']['col_index'] > data['MS']['col_index']
    assert data['CA']['col_index'] > data['AR']['col_index']


def test_indices_within_sane_range(entries):
    for e in entries:
        if e['area'] == 'United States':
            continue
        assert 50 <= e['col_index'] <= 200, e
