import mongoose, { HydratedDocument } from 'mongoose';
import { connectDB, disconnectDB } from '../db/mongoose';
import { fetchSecrets } from '../config/secrets';
import { User, IUser } from '../models/User';
import { Doctor, IDoctor, IAvailability } from '../models/Doctor';
import { Department, IDepartment } from '../models/Department';
import { Patient, IPatient } from '../models/Patient';
import { Receptionist } from '../models/Receptionist';
import { Appointment } from '../models/Appointment';
import { Invoice } from '../models/Invoice';

const SEED_PASSWORD = 'Hospital@123';

function getUpcomingWeekday(dayName: string, weeksAhead = 0): Date {
  const dayIndexMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const targetDay = dayIndexMap[dayName.toLowerCase()] ?? 1;
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const currentDay = d.getUTCDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  d.setUTCDate(d.getUTCDate() + diff + weeksAhead * 7);
  return d;
}

function getPastWeekday(dayName: string, weeksAgo = 1): Date {
  const dayIndexMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const targetDay = dayIndexMap[dayName.toLowerCase()] ?? 1;
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const currentDay = d.getUTCDay();
  let diff = currentDay - targetDay;
  if (diff <= 0) diff += 7;
  d.setUTCDate(d.getUTCDate() - (diff + (weeksAgo - 1) * 7));
  return d;
}

export async function runSeed(isReset = false): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed script in production environment!');
  }

  const secrets = await fetchSecrets();
  process.env.MONGODB_URI = secrets.MONGODB_URI;
  await connectDB(secrets.MONGODB_URI);

  if (isReset) {
    console.log('🧹 Reset requested: cleaning existing seeded collections...');
    await Promise.all([
      Appointment.deleteMany({}),
      Invoice.deleteMany({}),
      Patient.deleteMany({}),
      Doctor.deleteMany({}),
      Receptionist.deleteMany({}),
      Department.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('✅ Collections cleared.');
  }

  console.log('🌱 Seeding PulseCare HMS database...');

  // Helper to upsert a User document
  async function ensureUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    role: 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient';
    phone?: string;
  }): Promise<HydratedDocument<IUser>> {
    let u = await User.findOne({ email: userData.email });
    if (!u) {
      u = new User({
        ...userData,
        password: SEED_PASSWORD,
        isActive: true,
      });
      await u.save();
    } else {
      u.firstName = userData.firstName;
      u.lastName = userData.lastName;
      u.role = userData.role;
      u.phone = userData.phone;
      u.password = SEED_PASSWORD;
      await u.save();
    }
    return u;
  }

  // 1. Admin User
  const adminUser = await ensureUser({
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@pulsecare.test',
    role: 'admin',
    phone: '+1-555-0100',
  });

  // 2. Receptionist User
  const receptionUser = await ensureUser({
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'reception@pulsecare.test',
    role: 'receptionist',
    phone: '+1-555-0101',
  });

  // 3. Doctors
  const doc1User = await ensureUser({
    firstName: 'Alexander',
    lastName: 'Smith',
    email: 'dr.smith@pulsecare.test',
    role: 'doctor',
    phone: '+1-555-0102',
  });

  const doc2User = await ensureUser({
    firstName: 'Emily',
    lastName: 'Chen',
    email: 'dr.chen@pulsecare.test',
    role: 'doctor',
    phone: '+1-555-0103',
  });

  const doc3User = await ensureUser({
    firstName: 'Rajesh',
    lastName: 'Patel',
    email: 'dr.patel@pulsecare.test',
    role: 'doctor',
    phone: '+1-555-0104',
  });

  // 4. Departments
  async function ensureDepartment(data: {
    name: string;
    description: string;
    location: string;
  }): Promise<HydratedDocument<IDepartment>> {
    let dept = await Department.findOne({ name: data.name });
    if (!dept) {
      dept = new Department(data);
      await dept.save();
    }
    return dept;
  }

  const cardioDept = await ensureDepartment({
    name: 'Cardiology',
    description: 'Comprehensive cardiovascular care and diagnostic center',
    location: 'Building A, Floor 2',
  });

  const pedsDept = await ensureDepartment({
    name: 'Pediatrics',
    description: 'Specialized pediatric medicine and child health services',
    location: 'Building B, Floor 1',
  });

  const orthoDept = await ensureDepartment({
    name: 'Orthopedics',
    description: 'Musculoskeletal trauma, spine, and joint care',
    location: 'Building A, Floor 3',
  });

  // Upsert Doctor Profiles
  async function ensureDoctor(
    user: HydratedDocument<IUser>,
    dept: HydratedDocument<IDepartment>,
    docData: {
      specialization: string;
      qualification: string[];
      consultationFee: number;
      availability: IAvailability[];
    }
  ): Promise<HydratedDocument<IDoctor>> {
    let d = await Doctor.findOne({ userId: user._id });
    if (!d) {
      d = new Doctor({
        userId: user._id,
        department: dept._id,
        ...docData,
      });
      await d.save();
    } else {
      d.department = dept._id as mongoose.Types.ObjectId;
      d.specialization = docData.specialization;
      d.qualification = docData.qualification;
      d.consultationFee = docData.consultationFee;
      d.availability = docData.availability;
      await d.save();
    }
    return d;
  }

  const doc1 = await ensureDoctor(doc1User, cardioDept, {
    specialization: 'Cardiology',
    qualification: ['MD', 'FACC'],
    consultationFee: 150,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '17:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '17:00' },
      { day: 'thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'friday', startTime: '09:00', endTime: '17:00' },
    ], // Saturday and Sunday off
  });

  const doc2 = await ensureDoctor(doc2User, pedsDept, {
    specialization: 'Pediatrics',
    qualification: ['MD', 'FAAP'],
    consultationFee: 120,
    availability: [
      { day: 'tuesday', startTime: '10:00', endTime: '18:00' },
      { day: 'wednesday', startTime: '10:00', endTime: '18:00' },
      { day: 'thursday', startTime: '10:00', endTime: '18:00' },
      { day: 'friday', startTime: '10:00', endTime: '18:00' },
      { day: 'saturday', startTime: '10:00', endTime: '16:00' },
    ], // Sunday and Monday off
  });

  const doc3 = await ensureDoctor(doc3User, orthoDept, {
    specialization: 'Orthopedics',
    qualification: ['MS (Ortho)', 'FRCS'],
    consultationFee: 180,
    availability: [
      { day: 'monday', startTime: '08:30', endTime: '16:30' },
      { day: 'wednesday', startTime: '08:30', endTime: '16:30' },
      { day: 'thursday', startTime: '08:30', endTime: '16:30' },
      { day: 'friday', startTime: '08:30', endTime: '16:30' },
      { day: 'saturday', startTime: '09:00', endTime: '13:00' },
    ], // Tuesday and Sunday off
  });

  // Assign head doctors to departments
  cardioDept.head = doc1._id as mongoose.Types.ObjectId;
  await cardioDept.save();
  pedsDept.head = doc2._id as mongoose.Types.ObjectId;
  await pedsDept.save();
  orthoDept.head = doc3._id as mongoose.Types.ObjectId;
  await orthoDept.save();

  // Upsert Receptionist Profile
  let rec = await Receptionist.findOne({ userId: receptionUser._id });
  if (!rec) {
    rec = new Receptionist({
      userId: receptionUser._id,
      department: cardioDept._id,
    });
    await rec.save();
  }

  // 5. Patients
  const patientDataList = [
    {
      user: { firstName: 'James', lastName: 'Wilson', email: 'patient1@pulsecare.test', phone: '+1-555-0201' },
      profile: { bloodGroup: 'O+', allergies: ['Penicillin'], emergencyContact: { name: 'Mary Wilson', relationship: 'Spouse', phone: '+1-555-0202' } },
    },
    {
      user: { firstName: 'Sophia', lastName: 'Martinez', email: 'patient2@pulsecare.test', phone: '+1-555-0203' },
      profile: { bloodGroup: 'A+', allergies: ['Peanuts', 'Sulfa drugs'], emergencyContact: { name: 'Carlos Martinez', relationship: 'Father', phone: '+1-555-0204' } },
    },
    {
      user: { firstName: 'Liam', lastName: 'Johnson', email: 'patient3@pulsecare.test', phone: '+1-555-0205' },
      profile: { bloodGroup: 'B-', allergies: [], emergencyContact: { name: 'Emma Johnson', relationship: 'Mother', phone: '+1-555-0206' } },
    },
    {
      user: { firstName: 'Olivia', lastName: 'Davis', email: 'patient4@pulsecare.test', phone: '+1-555-0207' },
      profile: { bloodGroup: 'AB+', allergies: ['Latex'], emergencyContact: { name: 'William Davis', relationship: 'Brother', phone: '+1-555-0208' } },
    },
    {
      user: { firstName: 'Noah', lastName: 'Brown', email: 'patient5@pulsecare.test', phone: '+1-555-0209' },
      profile: { bloodGroup: 'O-', allergies: ['Aspirin'], emergencyContact: { name: 'Lucas Brown', relationship: 'Guardian', phone: '+1-555-0210' } },
    },
  ];

  const patients: HydratedDocument<IPatient>[] = [];
  for (const item of patientDataList) {
    const u = await ensureUser({
      ...item.user,
      role: 'patient',
    });
    let p = await Patient.findOne({ userId: u._id });
    if (!p) {
      p = new Patient({
        userId: u._id,
        bloodGroup: item.profile.bloodGroup as any,
        allergies: item.profile.allergies,
        emergencyContact: item.profile.emergencyContact,
      });
      await p.save();
    } else {
      p.bloodGroup = item.profile.bloodGroup as any;
      p.allergies = item.profile.allergies;
      p.emergencyContact = item.profile.emergencyContact;
      await p.save();
    }
    patients.push(p);
  }

  // 6. Appointments (8 appointments across past, today, future)
  const pastMon = getPastWeekday('monday', 1);
  const pastWed = getPastWeekday('wednesday', 1);
  const pastFri = getPastWeekday('friday', 1);
  const nextMon = getUpcomingWeekday('monday', 0);
  const nextTue = getUpcomingWeekday('tuesday', 0);
  const nextWed = getUpcomingWeekday('wednesday', 0);
  const nextThu = getUpcomingWeekday('thursday', 0);

  const appointmentDefs = [
    // Completed past appointments
    { patient: patients[0], doctor: doc1, date: pastMon, timeSlot: '09:00', status: 'completed', type: 'consultation', reason: 'Routine heart checkup' },
    { patient: patients[1], doctor: doc2, date: pastWed, timeSlot: '11:00', status: 'completed', type: 'consultation', reason: 'Annual pediatric checkup' },
    { patient: patients[2], doctor: doc3, date: pastFri, timeSlot: '10:00', status: 'completed', type: 'procedure', reason: 'Knee joint assessment' },
    // Cancelled appointment
    { patient: patients[3], doctor: doc1, date: pastWed, timeSlot: '14:00', status: 'cancelled', type: 'consultation', reason: 'Hypertension follow-up', cancelReason: 'Patient rescheduled' },
    // Upcoming scheduled / confirmed appointments
    { patient: patients[0], doctor: doc1, date: nextMon, timeSlot: '10:00', status: 'confirmed', type: 'follow-up', reason: 'ECG review' },
    { patient: patients[1], doctor: doc2, date: nextTue, timeSlot: '14:00', status: 'scheduled', type: 'consultation', reason: 'Vaccination booster' },
    { patient: patients[2], doctor: doc3, date: nextWed, timeSlot: '11:00', status: 'confirmed', type: 'follow-up', reason: 'Post-op physiotherapy check' },
    { patient: patients[4], doctor: doc1, date: nextThu, timeSlot: '11:30', status: 'scheduled', type: 'consultation', reason: 'Mild chest tightness consultation' },
  ];

  const createdAppointments = [];
  for (const apptDef of appointmentDefs) {
    let appt = await Appointment.findOne({
      doctor: apptDef.doctor._id,
      date: apptDef.date,
      timeSlot: apptDef.timeSlot,
    });
    if (!appt) {
      appt = new Appointment({
        patient: apptDef.patient._id,
        doctor: apptDef.doctor._id,
        department: apptDef.doctor.department,
        date: apptDef.date,
        timeSlot: apptDef.timeSlot,
        status: apptDef.status,
        type: apptDef.type,
        reason: apptDef.reason,
        cancelReason: apptDef.cancelReason,
        createdBy: adminUser._id,
      });
      await appt.save();
    }
    createdAppointments.push(appt);
  }

  // 7. Invoices (3 invoices: 1 Draft, 1 Issued, 1 Paid)
  // Invoice 1: Draft
  const existingInv1 = await Invoice.findOne({ patient: patients[0]._id, status: 'draft' });
  if (!existingInv1) {
    const inv1 = new Invoice({
      patient: patients[0]._id,
      appointment: createdAppointments[4]?._id,
      lineItems: [
        { description: 'Cardiology Consultation', quantity: 1, unitPrice: 150 },
        { description: 'ECG Test Diagnostic', quantity: 1, unitPrice: 75 },
      ],
      taxRate: 10,
      discount: 15,
      status: 'draft',
      issuedBy: adminUser._id,
      notes: 'Initial consultation draft bill',
    });
    await inv1.save();
  }

  // Invoice 2: Issued
  const existingInv2 = await Invoice.findOne({ patient: patients[1]._id, status: 'issued' });
  if (!existingInv2) {
    const inv2 = new Invoice({
      patient: patients[1]._id,
      appointment: createdAppointments[1]?._id,
      lineItems: [
        { description: 'Pediatric Wellness Exam', quantity: 1, unitPrice: 120 },
        { description: 'Booster Immunization', quantity: 1, unitPrice: 45 },
      ],
      taxRate: 5,
      discount: 0,
      status: 'issued',
      issuedDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      issuedBy: receptionUser._id,
      notes: 'Please remit payment within 14 days',
    });
    await inv2.save();
  }

  // Invoice 3: Paid with payment record
  const existingInv3 = await Invoice.findOne({ patient: patients[2]._id, status: 'paid' });
  if (!existingInv3) {
    const inv3 = new Invoice({
      patient: patients[2]._id,
      appointment: createdAppointments[2]?._id,
      lineItems: [
        { description: 'Orthopedic Knee Joint Examination', quantity: 1, unitPrice: 180 },
        { description: 'Joint Support Brace', quantity: 1, unitPrice: 60 },
      ],
      taxRate: 10,
      discount: 20,
      status: 'paid',
      issuedDate: new Date(Date.now() - 7 * 86400000),
      dueDate: new Date(Date.now() + 7 * 86400000),
      paidDate: new Date(),
      issuedBy: adminUser._id,
      payments: [
        {
          amount: 242,
          method: 'card',
          paidAt: new Date(),
          reference: 'TXN-CARD-99214',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Fully settled at reception counter',
    });
    await inv3.save();
  }

  console.log('\n======================================================');
  console.log('       ✨ PulseCare HMS Seed Data Generated ✨');
  console.log('======================================================');
  console.log('Default Password for ALL accounts: ' + SEED_PASSWORD);
  console.log('------------------------------------------------------');
  console.log('| Role         | Email                     | Name              |');
  console.log('------------------------------------------------------');
  console.log('| Admin        | admin@pulsecare.test      | System Admin      |');
  console.log('| Receptionist | reception@pulsecare.test  | Sarah Jenkins     |');
  console.log('| Doctor (Card)| dr.smith@pulsecare.test   | Dr. Alexander Smith|');
  console.log('| Doctor (Peds)| dr.chen@pulsecare.test    | Dr. Emily Chen    |');
  console.log('| Doctor (Orth)| dr.patel@pulsecare.test   | Dr. Rajesh Patel  |');
  console.log('| Patient 1    | patient1@pulsecare.test   | James Wilson      |');
  console.log('| Patient 2    | patient2@pulsecare.test   | Sophia Martinez   |');
  console.log('| Patient 3    | patient3@pulsecare.test   | Liam Johnson      |');
  console.log('| Patient 4    | patient4@pulsecare.test   | Olivia Davis      |');
  console.log('| Patient 5    | patient5@pulsecare.test   | Noah Brown        |');
  console.log('======================================================\n');
}

// Direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');
  const isConfirmed = args.includes('--yes');

  if (isReset && !isConfirmed) {
    console.error('⚠️  --reset requires explicit confirmation flag: --yes');
    process.exit(1);
  }

  runSeed(isReset)
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}
