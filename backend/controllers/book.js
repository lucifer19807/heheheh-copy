import Booking from '../models/booking.js';
import Room from '../models/room.js';
import BookedDate from '../models/bookedDates.js';
import Cart_item from '../models/cart.js';

const createOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const cartItems = await Cart_item.find({ userId });

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const bookings = [];
        const errors = [];

        for (const cartItem of cartItems) {
            const { roomType, checkIn, checkOut, quantity, adults, children } = cartItem;
            const room = await Room.findOne({ roomType });

            if (!room) {
                errors.push({ roomType, message: 'Room type not found' });
                continue;
            }

            const totalDays = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24);
            const totalAmount = totalDays * quantity * room.price * 100; // Amount in paise
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);

            for (let date = new Date(checkInDate); date < checkOutDate; date.setDate(date.getDate() + 1)) {
                const formattedDate = new Date(date).toISOString().split('T')[0];
                const existingDate = await BookedDate.findOne({ date: formattedDate, roomType });

                if (existingDate) {
                    existingDate.quantity += quantity;
                    await existingDate.save();
                } else {
                    await BookedDate.create({
                        date: formattedDate,
                        roomType,
                        quantity
                    });
                }
            }

            const booking = await Booking.create({
                userId,
                adults,
                children,
                roomType,
                checkIn,
                checkOut,
                roomsBooked: quantity,
                totalAmount,
                status: 'pending'
            });

            bookings.push(booking);
        }

        // Clear the cart after successful bookings
        await Cart_item.deleteMany({ userId });

        const responseMessage = {
            success: true,
            message: 'Bookings created successfully',
            bookings,
        };

        if (errors.length > 0) {
            responseMessage.errors = errors;
        }

        res.status(200).json(responseMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to create orders' });
    }
};

export default createOrder;
