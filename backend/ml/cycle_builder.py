import datetime

def build_cycles(period_days):
    """
    Args:
        period_days: sorted list of datetime.date objects representing bleeding days.
    Returns:
        cycles: List of dictionaries representing actual completed cycles.
        [{
            'period_start': 'YYYY-MM-DD',
            'period_end': 'YYYY-MM-DD',
            'period_length': 5,
            'cycle_start': 'YYYY-MM-DD',
            'cycle_end': 'YYYY-MM-DD', # (The day before next period starts)
            'cycle_length': 28
        }, ...]
        ongoing_cycle: Dictionary for the current unfinished cycle, or None.
    """
    if not period_days:
        return [], None
    
    periods = []
    start = None
    end = None
    
    for d in period_days:
        if start is None:
            start = d
            end = d
        elif (d - end).days <= 1:
            end = d
        else:
            periods.append({'start': start, 'end': end})
            start = d
            end = d
    if start is not None:
        periods.append({'start': start, 'end': end})
        
    cycles = []
    # A cycle spans from start of Period N to start of Period N+1
    for i in range(len(periods) - 1):
        period_n = periods[i]
        period_next = periods[i+1]
        
        cycle_len = (period_next['start'] - period_n['start']).days
        
        cycles.append({
            'period_start': period_n['start'],
            'period_end': period_n['end'],
            'period_length': (period_n['end'] - period_n['start']).days + 1,
            'cycle_start': period_n['start'],
            'cycle_end': period_next['start'] - datetime.timedelta(days=1),
            'cycle_length': cycle_len
        })
        
    # The last period is the "ongoing" cycle (no next period yet to mark its end)
    ongoing_cycle = None
    if periods:
        last_period = periods[-1]
        ongoing_cycle = {
            'period_start': last_period['start'],
            'period_end': last_period['end'],
            'period_length': (last_period['end'] - last_period['start']).days + 1,
            'cycle_start': last_period['start']
        }
    
    return cycles, ongoing_cycle
