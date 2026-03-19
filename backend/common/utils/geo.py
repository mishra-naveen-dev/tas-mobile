import math


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points on Earth (in kilometers).
    Uses the Haversine formula for great-circle distance.

    Args:
        lat1, lon1: Starting point coordinates (latitude, longitude)
        lat2, lon2: Ending point coordinates (latitude, longitude)

    Returns:
        float: Distance in kilometers
    """
    # Validate input coordinates
    if not all(isinstance(x, (int, float)) for x in [lat1, lon1, lat2, lon2]):
        raise ValueError("All coordinates must be numeric")

    # Check if coordinates are within valid range
    if not (-90 <= lat1 <= 90 and -180 <= lon1 <= 180):
        raise ValueError(f"Invalid lat1/lon1: {lat1}, {lon1}")
    if not (-90 <= lat2 <= 90 and -180 <= lon2 <= 180):
        raise ValueError(f"Invalid lat2/lon2: {lat2}, {lon2}")

    # If coordinates are identical, distance is 0
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    R = 6371  # Earth's radius in kilometers

    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    # Haversine formula
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * \
        math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    distance = R * c

    # Final validation: distance should not exceed Earth's circumference
    earth_circumference = 40075  # km
    if distance > earth_circumference / 2:
        # This shouldn't happen with valid coordinates
        raise ValueError(
            f"Calculated distance {distance}km exceeds half Earth's circumference. Invalid coordinates: ({lat1},{lon1}) to ({lat2},{lon2})")

    return distance


def get_distance_in_range(distance_km):
    """
    Check if distance is within allowed range for work from office.

    Returns:
        bool: True if distance is within acceptable range
    """
    MAX_OFFICE_DISTANCE = 5  # km
    return distance_km <= MAX_OFFICE_DISTANCE
