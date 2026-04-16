function createAppointmentFactory ({ appointmentRepository, logger }) {
  return async function execute ({ request }, callback) {
    let createdAppointment = null;
    try {
      const { payload } = request
      const {
        companyId,
        doctorId,
        doctorData,
        userId,
        userData,
        startTime,
        appointmentTime,
        amount // Added for SAGA payment
      } = JSON.parse(payload)

      // 1. Create Appointment (SAGA Init)
      createdAppointment = await appointmentRepository.create({
        params: {
          company_id: companyId,
          doctor_id: doctorId,
          doctor_data: doctorData,
          user_id: userId,
          user_data: userData,
          start_time: startTime,
          appointment_time: appointmentTime,
          status: 'PENDING'
        },
      })
      
      logger.info({
        message: 'SAGA Step 1: Appointment created (PENDING)',
        appointment_id: createdAppointment.id,
      })

      // 2. Mock Payment Service call
      const paymentSuccess = true; // Simulating successful payment
      
      if (!paymentSuccess) {
        throw new Error('Payment Failed');
      }
      
      logger.info({ message: 'SAGA Step 2: Payment Processed Successfully' })

      // 3. Mark Confirmed (SAGA Completion)
      // Note: Assuming a repository update method exists, or just returning mock updated status
      createdAppointment.status = 'CONFIRMED';
      
      logger.info({ message: 'SAGA Step 3: Appointment CONFIRMED' })

      // 4. Mock Notification & Telemedicine
      logger.info({ message: 'SAGA Step 4: Sent Notifications & Generated Telemedicine URL' })
      createdAppointment.telemedicine_url = "https://meet.healthcare.com/" + createdAppointment.id

      return callback(null, {
        id: createdAppointment.id,
        payload: JSON.stringify(createdAppointment),
      })
    } catch (error) {
      if (createdAppointment) {
         // Rollback logic
         logger.info({ message: 'SAGA Rollback: Cancelling appointment due to failure' })
         createdAppointment.status = 'CANCELLED';
      }
      logger.error('SAGA failed, transaction rolled back', error);
      return callback({
         code: 13, // grpc.status.INTERNAL
         message: error.message
      });
    }
  }
}

export default createAppointmentFactory
