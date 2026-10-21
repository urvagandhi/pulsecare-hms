import { Types } from 'mongoose';
import { User } from '../../models/User';
import { Doctor } from '../../models/Doctor';
import { Nurse } from '../../models/Nurse';
import { Receptionist } from '../../models/Receptionist';
import { Department } from '../../models/Department';
import { Appointment } from '../../models/Appointment';
import { emitToUser } from '../../socket';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { z } from 'zod';
import { CreateStaffSchema, UpdateStaffSchema, CreateDepartmentSchema, UpdateDepartmentSchema } from './schema';
import { getUtcDayOfWeek, parseUtcMidnight } from '../../utils/dateUtils';

async function cancelConflictingAppointmentsForLeaves(
  doctorId: Types.ObjectId,
  doctorUserId: Types.ObjectId,
  leaves: Array<{ startDate: Date; endDate: Date; reason?: string }>
) {
  if (!leaves || leaves.length === 0) return;

  for (const leave of leaves) {
    const start = new Date(leave.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leave.endDate);
    end.setHours(23, 59, 59, 999);

    const conflicting = await Appointment.find({
      doctor: doctorId,
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'confirmed'] },
    }).populate('patient');

    const reasonText = leave.reason
      ? `Doctor on emergency leave (${leave.reason}) — Rescheduling required by receptionist`
      : 'Doctor on emergency leave — Rescheduling required by receptionist';

    for (const appt of conflicting) {
      appt.status = 'cancelled';
      appt.cancelledBy = doctorUserId;
      appt.cancelReason = reasonText;
      await appt.save();

      try {
        const patientUserId = (appt.patient as any)?.userId;
        if (patientUserId) {
          emitToUser(patientUserId.toString(), 'appointment:statusChanged', {
            appointmentId: appt._id.toString(),
            appointmentRef: appt.appointmentId,
            status: 'cancelled',
            reason: reasonText,
          });
        }
      } catch {
        // Socket emission failure shouldn't fail leave creation
      }
    }
  }
}

type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;

export async function createStaffMember(input: CreateStaffInput) {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw new ConflictError('Email already registered');

  if (input.role === 'doctor' && !input.specialization) {
    throw new ValidationError('Specialization is required for doctors');
  }

  // NOTE: Not using Mongoose sessions/transactions here for single-instance compatibility.
  // In a production multi-replica environment, wrap these in a session transaction.
  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: input.password,
    role: input.role,
    phone: input.phone,
    dob: input.dob ? new Date(input.dob) : undefined,
    gender: input.gender,
  });

  let profile;
  try {
    if (input.role === 'doctor') {
      profile = await Doctor.create({
        userId: user._id,
        specialization: input.specialization!,
        qualification: input.qualification ?? [],
        department: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
        consultationFee: input.consultationFee ?? 0,
      });
    } else if (input.role === 'nurse') {
      profile = await Nurse.create({
        userId: user._id,
        ward: input.ward,
        department: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
        shift: input.shift ?? 'morning',
        qualification: input.qualification ?? [],
      });
    } else if (input.role === 'receptionist') {
      profile = await Receptionist.create({
        userId: user._id,
        department: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
      });
    }
  } catch (err) {
    // Best-effort cleanup if profile creation fails
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  return { user, profile };
}

function getModelForRole(role: string) {
  if (role === 'doctor') return Doctor;
  if (role === 'nurse') return Nurse;
  if (role === 'receptionist') return Receptionist;
  throw new AppError(400, 'INVALID_ROLE', `Unknown staff role: ${role}`);
}

export async function getStaffMember(userId: string) {
  const user = await User.findById(userId).select('-password').lean();
  if (!user) throw new NotFoundError('Staff member');

  // Find profile based on role
  let profile = null;
  if (user.role === 'doctor') {
    profile = await Doctor.findOne({ userId }).populate('department').lean();
  } else if (user.role === 'nurse') {
    profile = await Nurse.findOne({ userId }).populate('department').lean();
  } else if (user.role === 'receptionist') {
    profile = await Receptionist.findOne({ userId }).populate('department').lean();
  }

  return { user, profile };
}

export async function listStaff(filters: {
  role?: string;
  department?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  const { role, department, isActive = true, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  // Build profile filter
  const profileFilter: Record<string, unknown> = { isActive };
  if (department) profileFilter.department = new Types.ObjectId(department);

  if (role) {
    // Single-role query — straightforward
    const Model = getModelForRole(role) as typeof Doctor;
    const [data, total] = await Promise.all([
      Model.find(profileFilter)
        .populate('userId', '-password')
        .populate('department')
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(profileFilter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Multi-role: fetch all, combine, then slice
  const [doctors, nurses, receptionists] = await Promise.all([
    Doctor.find(profileFilter).populate('userId', '-password').populate('department').lean(),
    Nurse.find(profileFilter).populate('userId', '-password').populate('department').lean(),
    Receptionist.find(profileFilter).populate('userId', '-password').populate('department').lean(),
  ]);

  const all = [...doctors, ...nurses, ...receptionists];
  const total = all.length;
  const data = all.slice(skip, skip + limit);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateStaffMember(userId: string, input: UpdateStaffInput) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Staff member');

  // Update User fields
  const userFields: Partial<typeof input> = {};
  if (input.firstName !== undefined) userFields.firstName = input.firstName;
  if (input.lastName !== undefined) userFields.lastName = input.lastName;
  if (input.phone !== undefined) userFields.phone = input.phone;
  if (input.dob !== undefined) userFields.dob = input.dob;
  if (input.gender !== undefined) userFields.gender = input.gender;

  if (Object.keys(userFields).length > 0) {
    await User.findByIdAndUpdate(userId, userFields);
  }

  // Update profile fields based on role
  const profileFields: Record<string, unknown> = {};
  if (input.departmentId !== undefined)
    profileFields.department = input.departmentId ? new Types.ObjectId(input.departmentId) : null;

  if (user.role === 'doctor') {
    if (input.specialization !== undefined) profileFields.specialization = input.specialization;
    if (input.qualification !== undefined) profileFields.qualification = input.qualification;
    if (input.consultationFee !== undefined) profileFields.consultationFee = input.consultationFee;
    if (input.leaves !== undefined) {
      const parsedLeaves = input.leaves.map((l) => ({
        startDate: new Date(l.startDate),
        endDate: new Date(l.endDate),
        reason: l.reason,
      }));
      profileFields.leaves = parsedLeaves;
      const updatedDoc = await Doctor.findOneAndUpdate({ userId }, profileFields, { new: true });
      if (updatedDoc) {
        await cancelConflictingAppointmentsForLeaves(
          updatedDoc._id,
          updatedDoc.userId as Types.ObjectId,
          parsedLeaves
        );
      }
    } else {
      await Doctor.findOneAndUpdate({ userId }, profileFields);
    }
  } else if (user.role === 'nurse') {
    if (input.ward !== undefined) profileFields.ward = input.ward;
    if (input.shift !== undefined) profileFields.shift = input.shift;
    if (input.qualification !== undefined) profileFields.qualification = input.qualification;
    await Nurse.findOneAndUpdate({ userId }, profileFields);
  } else if (user.role === 'receptionist') {
    await Receptionist.findOneAndUpdate({ userId }, profileFields);
  }

  return User.findById(userId);
}

export async function deactivateStaff(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Staff member');

  await User.findByIdAndUpdate(userId, { isActive: false });

  if (user.role === 'doctor') {
    await Doctor.findOneAndUpdate({ userId }, { isActive: false });
  } else if (user.role === 'nurse') {
    await Nurse.findOneAndUpdate({ userId }, { isActive: false });
  } else if (user.role === 'receptionist') {
    await Receptionist.findOneAndUpdate({ userId }, { isActive: false });
  }
}

export async function getAvailableDoctors(date: string, specialization?: string) {
  const dayName = getUtcDayOfWeek(date);

  const filter: Record<string, unknown> = {
    isActive: true,
    'availability.day': dayName,
  };

  if (specialization) {
    filter.specialization = { $regex: new RegExp(specialization, 'i') };
  }

  const doctors = await Doctor.find(filter)
    .populate('userId', '-password -failedLoginAttempts -lockedUntil')
    .populate('department')
    .lean();

  const targetDateStr = parseUtcMidnight(date).toISOString().split('T')[0];
  return doctors.filter((doc) => {
    if (!doc.leaves || doc.leaves.length === 0) return true;
    const onLeave = doc.leaves.some((l) => {
      const startStr = new Date(l.startDate).toISOString().split('T')[0];
      const endStr = new Date(l.endDate).toISOString().split('T')[0];
      return targetDateStr >= startStr && targetDateStr <= endStr;
    });
    return !onLeave;
  });
}

export async function getDoctorProfile(id: string) {
  let doctor = null;
  if (Types.ObjectId.isValid(id)) {
    doctor = await Doctor.findOne({
      $or: [{ _id: new Types.ObjectId(id) }, { userId: new Types.ObjectId(id) }],
    })
      .populate('userId', '-password -failedLoginAttempts -lockedUntil')
      .populate('department')
      .lean();
  }
  if (!doctor) throw new NotFoundError('Doctor');
  return doctor;
}

export async function addDoctorLeave(id: string, leave: { startDate: string | Date; endDate: string | Date; reason?: string }) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Doctor');
  const doctor = await Doctor.findOne({
    $or: [{ _id: new Types.ObjectId(id) }, { userId: new Types.ObjectId(id) }],
  });
  if (!doctor) throw new NotFoundError('Doctor');

  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  if (end < start) {
    throw new ValidationError('endDate cannot be earlier than startDate');
  }

  doctor.leaves = doctor.leaves || [];
  doctor.leaves.push({
    startDate: start,
    endDate: end,
    reason: leave.reason,
  });
  await doctor.save();

  // Automatically cancel active appointments falling within the doctor's leave window
  await cancelConflictingAppointmentsForLeaves(
    doctor._id,
    doctor.userId as Types.ObjectId,
    [{ startDate: start, endDate: end, reason: leave.reason }]
  );

  return doctor;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const existing = await Department.findOne({ name: input.name });
  if (existing) throw new ConflictError('Department with this name already exists');

  let headObjectId: Types.ObjectId | undefined;
  if (input.headDoctorId) {
    const doctor = await Doctor.findById(input.headDoctorId);
    if (!doctor) throw new NotFoundError('Doctor');
    headObjectId = doctor._id;
  }

  const department = await Department.create({
    name: input.name,
    description: input.description,
    head: headObjectId,
    bedCount: input.bedCount ?? 0,
    location: input.location,
  });

  return department;
}

export async function listDepartments() {
  return Department.find({ isActive: true })
    .populate({
      path: 'head',
      populate: { path: 'userId', select: 'firstName lastName email' },
    })
    .lean();
}

export async function updateDepartment(deptId: string, input: UpdateDepartmentInput) {
  const dept = await Department.findById(deptId);
  if (!dept) throw new NotFoundError('Department');

  const updateFields: Record<string, unknown> = {};
  if (input.name !== undefined) updateFields.name = input.name;
  if (input.description !== undefined) updateFields.description = input.description;
  if (input.bedCount !== undefined) updateFields.bedCount = input.bedCount;
  if (input.location !== undefined) updateFields.location = input.location;

  if (input.headDoctorId !== undefined) {
    if (input.headDoctorId) {
      const doctor = await Doctor.findById(input.headDoctorId);
      if (!doctor) throw new NotFoundError('Doctor');
      updateFields.head = doctor._id;
    } else {
      updateFields.head = null;
    }
  }

  return Department.findByIdAndUpdate(deptId, updateFields, { new: true })
    .populate({
      path: 'head',
      populate: { path: 'userId', select: 'firstName lastName email' },
    });
}
