from datetime import datetime, timezone

def convert_timestamp(timestamp):
    timestamp = timestamp / 1000
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime('%M:%S.%f')

# convert time string to datetime
print(convert_timestamp(1732502596367))