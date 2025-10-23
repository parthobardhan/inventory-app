const express = require('express');
const router = express.Router();
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize LiveKit Room Service Client
let roomService = null;
if (process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
    roomService = new RoomServiceClient(
        process.env.LIVEKIT_URL,
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET
    );
}

// POST /api/livekit/token - Generate access token for client to join room
router.post('/token', async (req, res) => {
    try {
        const { roomName, participantName } = req.body;

        // Validate required fields
        if (!roomName) {
            return res.status(400).json({
                success: false,
                error: 'Room name is required'
            });
        }

        // Check if LiveKit is configured
        if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
            return res.status(500).json({
                success: false,
                error: 'LiveKit is not configured. Please add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to your environment variables.'
            });
        }

        // Generate a unique participant name if not provided
        const identity = participantName || `user_${uuidv4().substring(0, 8)}`;

        // Create access token
        const token = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: identity,
                ttl: '1h' // Token valid for 1 hour
            }
        );

        // Grant permissions
        token.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true
        });

        const jwt = await token.toJwt();

        console.log(`✅ Generated LiveKit token for ${identity} in room ${roomName}`);

        res.json({
            success: true,
            token: jwt,
            url: process.env.LIVEKIT_URL,
            roomName: roomName,
            participantName: identity
        });

    } catch (error) {
        console.error('❌ Error generating LiveKit token:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate LiveKit token'
        });
    }
});

// GET /api/livekit/rooms - List active rooms (for monitoring)
router.get('/rooms', async (req, res) => {
    try {
        if (!roomService) {
            return res.status(500).json({
                success: false,
                error: 'LiveKit Room Service is not initialized'
            });
        }

        const rooms = await roomService.listRooms();

        res.json({
            success: true,
            rooms: rooms.map(room => ({
                name: room.name,
                sid: room.sid,
                numParticipants: room.numParticipants,
                creationTime: room.creationTime,
                emptyTimeout: room.emptyTimeout,
                maxParticipants: room.maxParticipants
            }))
        });

    } catch (error) {
        console.error('❌ Error listing LiveKit rooms:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list rooms'
        });
    }
});

// GET /api/livekit/status - Check if LiveKit is configured
router.get('/status', (req, res) => {
    const isConfigured = !!(
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET
    );

    res.json({
        success: true,
        configured: isConfigured,
        ready: isConfigured && !!roomService,
        message: isConfigured
            ? 'LiveKit is configured and ready'
            : 'LiveKit is not configured. Please add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to your environment variables.'
    });
});

// DELETE /api/livekit/room/:roomName - Delete a room
router.delete('/room/:roomName', async (req, res) => {
    try {
        const { roomName } = req.params;

        if (!roomService) {
            return res.status(500).json({
                success: false,
                error: 'LiveKit Room Service is not initialized'
            });
        }

        await roomService.deleteRoom(roomName);

        console.log(`✅ Deleted LiveKit room: ${roomName}`);

        res.json({
            success: true,
            message: `Room ${roomName} deleted successfully`
        });

    } catch (error) {
        console.error('❌ Error deleting LiveKit room:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete room'
        });
    }
});

module.exports = router;

