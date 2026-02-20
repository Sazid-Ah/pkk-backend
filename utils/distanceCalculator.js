/**
 * Distance Calculator Utility
 * Uses Haversine formula to calculate distance between two coordinates
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers

    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate distance for MongoDB geospatial query
 * @param {number} distance - Distance in kilometers
 * @returns {number} Distance in meters (for MongoDB $near operator)
 */
const kmToMeters = (km) => {
    return km * 1000;
};

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance string
 */
const formatDistance = (distance) => {
    if (distance < 1) {
        return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
};

/**
 * Get nearby pandits using MongoDB geospatial query
 * @param {object} Pandit - Mongoose model
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} maxDistance - Maximum distance in kilometers
 * @returns {Promise<array>} Array of pandits sorted by distance
 */
const getNearbyPandits = async (Pandit, latitude, longitude, maxDistance = 15) => {
    try {
        const pandits = await Pandit.find({
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude] // GeoJSON format: [lon, lat]
                    },
                    $maxDistance: kmToMeters(maxDistance)
                }
            }
        })
            .populate('occasions')
            .lean();

        // Calculate distance for each pandit and include in response
        const panditsWithDistance = pandits.map(pandit => {
            const panditLat = pandit.location.coordinates.coordinates[1];
            const panditLon = pandit.location.coordinates.coordinates[0];
            const distance = haversineDistance(latitude, longitude, panditLat, panditLon);

            return {
                ...pandit,
                distance,
                distanceFormatted: formatDistance(distance)
            };
        });

        return panditsWithDistance;
    } catch (error) {
        console.error('Error fetching nearby pandits:', error);
        throw error;
    }
};

/**
 * Search pandits by name/specialty with location bias
 * @param {object} Pandit - Mongoose model
 * @param {string} searchQuery - Search query
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} maxDistance - Maximum distance in kilometers
 * @returns {Promise<array>} Array of matching pandits sorted by relevance and distance
 */
const searchPanditsNearby = async (
    Pandit,
    searchQuery,
    latitude,
    longitude,
    maxDistance = 15
) => {
    try {
        const searchRegex = new RegExp(searchQuery, 'i');

        const pandits = await Pandit.find({
            $and: [
                {
                    $or: [
                        { name: searchRegex },
                        { specialty: searchRegex },
                        { specializations: searchRegex }
                    ]
                },
                {
                    'location.coordinates': {
                        $near: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [longitude, latitude]
                            },
                            $maxDistance: kmToMeters(maxDistance)
                        }
                    }
                }
            ]
        })
            .populate('occasions')
            .lean();

        // Calculate distance and sort by relevance
        const panditsWithDistance = pandits.map(pandit => {
            const panditLat = pandit.location.coordinates.coordinates[1];
            const panditLon = pandit.location.coordinates.coordinates[0];
            const distance = haversineDistance(latitude, longitude, panditLat, panditLon);

            return {
                ...pandit,
                distance,
                distanceFormatted: formatDistance(distance)
            };
        });

        // Sort by distance (nearest first)
        return panditsWithDistance.sort((a, b) => a.distance - b.distance);
    } catch (error) {
        console.error('Error searching nearby pandits:', error);
        throw error;
    }
};

module.exports = {
    haversineDistance,
    kmToMeters,
    formatDistance,
    getNearbyPandits,
    searchPanditsNearby
};
