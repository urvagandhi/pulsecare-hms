import 'dotenv/config';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { connectDB, disconnectDB } from '../db/mongoose';
import { fetchSecrets } from '../config/secrets';
import { User, IUser } from '../models/User';
import { Doctor, IDoctor, IAvailability } from '../models/Doctor';
import { Department, IDepartment } from '../models/Department';
import { Patient, IPatient } from '../models/Patient';
import { Receptionist } from '../models/Receptionist';
import { Appointment } from '../models/Appointment';
import { Invoice } from '../models/Invoice';
import { RefreshToken } from '../models/RefreshToken';
import { Prescription } from '../models/Prescription';
import { Drug } from '../models/Drug';
import { InventoryItem } from '../models/InventoryItem';
import { LabOrder } from '../models/LabOrder';
import { LabResult } from '../models/LabResult';
import { Document as ClinicalDoc } from '../models/Document';
import { Notification } from '../models/Notification';
import { StockMovement } from '../models/StockMovement';
import { Counter, clearCounterCache } from '../models/Counter';

export const SEED_PASSWORD = 'Test@123';

function getWeekdayDate(dayName: string, weekOffset = 0): Date {
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
  if (weekOffset > 0 && diff <= 0) diff += 7;
  if (weekOffset < 0 && diff >= 0) diff -= 7;
  d.setUTCDate(d.getUTCDate() + diff + weekOffset * 7);
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
    console.log('🧹 Complete Reset: wiping existing collections and resetting atomic sequence counters...');
    clearCounterCache();
    await Promise.all([
      Appointment.deleteMany({}),
      Invoice.deleteMany({}),
      Patient.deleteMany({}),
      Doctor.deleteMany({}),
      Receptionist.deleteMany({}),
      Department.deleteMany({}),
      User.deleteMany({}),
      RefreshToken.deleteMany({}),
      Prescription.deleteMany({}),
      Drug.deleteMany({}),
      InventoryItem.deleteMany({}),
      LabOrder.deleteMany({}),
      LabResult.deleteMany({}),
      ClinicalDoc.deleteMany({}),
      Notification.deleteMany({}),
      StockMovement.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    console.log('✅ All collections cleared & counters reset.');
  }

  console.log('🌱 Seeding PulseCare Multi-Speciality Hospital enterprise database...');

  // Helper to upsert a User document with custom registration timestamps & profile attributes
  async function ensureUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    role: 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient';
    phone?: string;
    dob?: Date;
    gender?: 'male' | 'female' | 'other';
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
    createdAt?: Date;
  }): Promise<HydratedDocument<IUser>> {
    let u = await User.findOne({ email: userData.email });
    if (!u) {
      u = new User({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        role: userData.role,
        phone: userData.phone,
        dob: userData.dob,
        gender: userData.gender,
        address: userData.address,
        password: SEED_PASSWORD,
        isActive: true,
      });
      if (userData.createdAt) {
        u.createdAt = userData.createdAt;
        u.updatedAt = userData.createdAt;
      }
      await u.save();
    } else {
      u.firstName = userData.firstName;
      u.lastName = userData.lastName;
      u.role = userData.role;
      u.phone = userData.phone;
      if (userData.dob) u.dob = userData.dob;
      if (userData.gender) u.gender = userData.gender;
      if (userData.address) u.address = userData.address;
      u.password = SEED_PASSWORD;
      await u.save();
    }
    if (userData.createdAt) {
      await User.updateOne(
        { _id: u._id },
        { $set: { createdAt: userData.createdAt, updatedAt: userData.createdAt } }
      );
      u.createdAt = userData.createdAt;
      u.updatedAt = userData.createdAt;
    }
    return u;
  }

  // ---------------------------------------------------------------------------
  // 1. HOSPITAL CORE STAFF (Admin & Reception)
  // ---------------------------------------------------------------------------
  const adminUser = await ensureUser({
    firstName: 'Rajesh',
    lastName: 'Malhotra',
    email: 'admin@pulsecare.test',
    role: 'admin',
    phone: '+91-98765-0100',
    dob: new Date('1978-05-12T00:00:00.000Z'),
    gender: 'male',
    address: {
      street: '104, Palm Grove Residency, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560038',
    },
    createdAt: new Date('2023-08-15T09:00:00.000Z'),
  });

  const receptionUser = await ensureUser({
    firstName: 'Pooja',
    lastName: 'Verma',
    email: 'reception@pulsecare.test',
    role: 'receptionist',
    phone: '+91-98765-0101',
    dob: new Date('1994-08-20T00:00:00.000Z'),
    gender: 'female',
    address: {
      street: '22, Rose Garden Enclave, HSR Layout Sector 2',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560102',
    },
    createdAt: new Date('2024-01-10T09:00:00.000Z'),
  });

  // ---------------------------------------------------------------------------
  // 2. MULTI-SPECIALTY DEPARTMENTS
  // ---------------------------------------------------------------------------
  async function ensureDepartment(data: {
    name: string;
    description: string;
    location: string;
    bedCount: number;
  }): Promise<HydratedDocument<IDepartment>> {
    let dept = await Department.findOne({ name: data.name });
    if (!dept) {
      dept = new Department(data);
      await dept.save();
    } else {
      dept.description = data.description;
      dept.location = data.location;
      dept.bedCount = data.bedCount;
      await dept.save();
    }
    return dept;
  }

  const cardioDept = await ensureDepartment({
    name: 'Cardiology',
    description: 'Advanced Heart & Vascular Institute: Interventional cardiology, electrophysiology, echocardiography, and cardiac ICU.',
    location: 'Building A, Floor 2 (Suites 201-220)',
    bedCount: 45,
  });

  const pedsDept = await ensureDepartment({
    name: 'Pediatrics',
    description: 'Childrens Healthcare Center: Neonatal ICU (NICU), pediatric pulmonology, immunizations, and developmental medicine.',
    location: 'Building B, Floor 1 (Suites 101-118)',
    bedCount: 30,
  });

  const orthoDept = await ensureDepartment({
    name: 'Orthopedics',
    description: 'Bone, Joint & Spine Pavilion: Robotic joint replacement, sports injury arthroscopy, trauma rehabilitation, and fracture clinic.',
    location: 'Building A, Floor 3 (Suites 301-325)',
    bedCount: 40,
  });

  const neuroDept = await ensureDepartment({
    name: 'Neurology',
    description: 'Brain & Spine Institute: Comprehensive stroke unit, epilepsy monitoring, neuro-muscular diagnostics, and cognitive therapy.',
    location: 'Building C, Floor 4 (Suites 401-415)',
    bedCount: 35,
  });

  const genMedDept = await ensureDepartment({
    name: 'General Medicine',
    description: 'Comprehensive Internal Medicine & Chronic Disease Pavilion: Diabetology, hypertension, fever triage, and preventative wellness.',
    location: 'Building A, Floor 1 (Suites 101-130)',
    bedCount: 50,
  });

  const dermDept = await ensureDepartment({
    name: 'Dermatology',
    description: 'Skin Health & Laser Center: Medical dermatology, autoimmune skin disorders, allergy patch testing, and dermatosurgery.',
    location: 'Building B, Floor 2 (Suites 201-212)',
    bedCount: 15,
  });

  // Assign receptionist to main reception desk in building A
  let rec = await Receptionist.findOne({ userId: receptionUser._id });
  if (!rec) {
    rec = new Receptionist({
      userId: receptionUser._id,
      department: genMedDept._id,
    });
    await rec.save();
  }
  await Receptionist.updateOne(
    { _id: rec._id },
    { $set: { createdAt: new Date('2024-01-10T09:00:00.000Z'), updatedAt: new Date('2024-01-10T09:00:00.000Z') } }
  );

  // ---------------------------------------------------------------------------
  // 3. MULTI-SPECIALTY CLINICAL FACULTY (Multiple Doctors per Specialty!)
  // ---------------------------------------------------------------------------
  async function ensureDoctor(
    user: HydratedDocument<IUser>,
    dept: HydratedDocument<IDepartment>,
    docData: {
      specialization: string;
      qualification: string[];
      consultationFee: number;
      availability: IAvailability[];
      leaves?: Array<{ startDate: Date; endDate: Date; reason?: string }>;
      rating?: number;
      reviewCount?: number;
      createdAt?: Date;
    }
  ): Promise<HydratedDocument<IDoctor>> {
    let d = await Doctor.findOne({ userId: user._id });
    if (!d) {
      d = new Doctor({
        userId: user._id,
        department: dept._id,
        ...docData,
      });
      if (docData.createdAt) {
        d.createdAt = docData.createdAt;
        d.updatedAt = docData.createdAt;
      }
      await d.save();
    } else {
      d.department = dept._id as mongoose.Types.ObjectId;
      d.specialization = docData.specialization;
      d.qualification = docData.qualification;
      d.consultationFee = docData.consultationFee;
      d.availability = docData.availability;
      d.leaves = docData.leaves || [];
      if (docData.rating !== undefined) d.rating = docData.rating;
      if (docData.reviewCount !== undefined) d.reviewCount = docData.reviewCount;
      await d.save();
    }
    const doctorCreatedAt = docData.createdAt || user.createdAt;
    if (doctorCreatedAt) {
      await Doctor.updateOne(
        { _id: d._id },
        { $set: { createdAt: doctorCreatedAt, updatedAt: doctorCreatedAt } }
      );
      d.createdAt = doctorCreatedAt;
      d.updatedAt = doctorCreatedAt;
    }
    return d;
  }

  // Next week dates for demonstrating Leave Engine / Automated Slot Blackout
  const upcomingWed = getWeekdayDate('wednesday', 1);
  const upcomingFri = getWeekdayDate('friday', 1);
  const upcomingTue = getWeekdayDate('tuesday', 1);

  // --- CARDIOLOGY (2 Specialists) ---
  const doc1User = await ensureUser({
    firstName: 'Arvind',
    lastName: 'Sharma',
    email: 'dr.sharma@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0102',
    dob: new Date('1972-03-14T00:00:00.000Z'),
    gender: 'male',
    address: { street: '42, Windmills of Your Mind, Whitefield', city: 'Bengaluru', state: 'Karnataka', zipCode: '560066' },
    createdAt: new Date('2024-01-15T09:00:00.000Z'),
  });
  const docCardioSenior = await ensureDoctor(doc1User, cardioDept, {
    specialization: 'Interventional Cardiology',
    qualification: ['MD (Medicine)', 'DM (Cardiology)', 'FACC'],
    consultationFee: 1200,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '13:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '13:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '13:00' },
      { day: 'thursday', startTime: '09:00', endTime: '13:00' },
      { day: 'friday', startTime: '09:00', endTime: '13:00' },
    ],
    leaves: [
      {
        startDate: upcomingWed,
        endDate: upcomingFri,
        reason: 'Keynote Speaker at National Cardiology Conclave 2026',
      },
    ],
    rating: 4.9,
    reviewCount: 142,
    createdAt: new Date('2024-01-15T09:00:00.000Z'),
  });

  const doc1bUser = await ensureUser({
    firstName: 'Vikram',
    lastName: 'Iyer',
    email: 'dr.viyer@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0112',
    dob: new Date('1985-11-28T00:00:00.000Z'),
    gender: 'male',
    address: { street: '302, Ozone Urbana, Devanahalli', city: 'Bengaluru', state: 'Karnataka', zipCode: '562110' },
    createdAt: new Date('2025-05-10T09:00:00.000Z'),
  });
  const docCardioJunior = await ensureDoctor(doc1bUser, cardioDept, {
    specialization: 'Non-Invasive Cardiology & Electrophysiology',
    qualification: ['MD (Internal Med)', 'DNB (Cardiology)'],
    consultationFee: 900,
    availability: [
      { day: 'monday', startTime: '13:00', endTime: '18:00' },
      { day: 'tuesday', startTime: '13:00', endTime: '18:00' },
      { day: 'wednesday', startTime: '13:00', endTime: '18:00' },
      { day: 'thursday', startTime: '13:00', endTime: '18:00' },
      { day: 'friday', startTime: '13:00', endTime: '18:00' },
      { day: 'saturday', startTime: '09:00', endTime: '14:00' },
    ],
    rating: 4.8,
    reviewCount: 96,
    createdAt: new Date('2025-05-10T09:00:00.000Z'),
  });

  // --- PEDIATRICS (2 Specialists) ---
  const doc2User = await ensureUser({
    firstName: 'Sneha',
    lastName: 'Kulkarni',
    email: 'dr.kulkarni@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0103',
    dob: new Date('1979-09-05T00:00:00.000Z'),
    gender: 'female',
    address: { street: '88, Greenwood Regency, Sarjapur Road', city: 'Bengaluru', state: 'Karnataka', zipCode: '560035' },
    createdAt: new Date('2024-02-01T09:00:00.000Z'),
  });
  const docPedsChief = await ensureDoctor(doc2User, pedsDept, {
    specialization: 'Chief Pediatrician & Neonatologist',
    qualification: ['MD (Pediatrics)', 'DNB (Pediatrics)', 'Fellowship Neonatology (AIIMS)'],
    consultationFee: 800,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '16:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '16:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '16:00' },
      { day: 'thursday', startTime: '09:00', endTime: '16:00' },
      { day: 'friday', startTime: '09:00', endTime: '16:00' },
      { day: 'saturday', startTime: '09:00', endTime: '13:00' },
    ],
    rating: 4.9,
    reviewCount: 185,
    createdAt: new Date('2024-02-01T09:00:00.000Z'),
  });

  const doc2bUser = await ensureUser({
    firstName: 'Ananya',
    lastName: 'Mukherjee',
    email: 'dr.amukherjee@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0113',
    dob: new Date('1987-04-16T00:00:00.000Z'),
    gender: 'female',
    address: { street: '14, Salarpuria Sattva Magnificence, Bannerghatta Road', city: 'Bengaluru', state: 'Karnataka', zipCode: '560076' },
    createdAt: new Date('2025-06-15T09:00:00.000Z'),
  });
  const docPedsPulmo = await ensureDoctor(doc2bUser, pedsDept, {
    specialization: 'Pediatric Pulmonology & Allergy',
    qualification: ['MD (Pediatrics)', 'DCH', 'Fellowship Pediatric Allergy'],
    consultationFee: 750,
    availability: [
      { day: 'monday', startTime: '11:00', endTime: '17:00' },
      { day: 'tuesday', startTime: '11:00', endTime: '17:00' },
      { day: 'wednesday', startTime: '11:00', endTime: '17:00' },
      { day: 'thursday', startTime: '11:00', endTime: '17:00' },
      { day: 'friday', startTime: '11:00', endTime: '17:00' },
      { day: 'saturday', startTime: '13:00', endTime: '17:00' },
    ],
    rating: 4.7,
    reviewCount: 78,
    createdAt: new Date('2025-06-15T09:00:00.000Z'),
  });

  // --- ORTHOPEDICS (2 Specialists) ---
  const doc3User = await ensureUser({
    firstName: 'Rajesh',
    lastName: 'Patel',
    email: 'dr.patel@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0104',
    dob: new Date('1970-07-22T00:00:00.000Z'),
    gender: 'male',
    address: { street: '105, Adarsh Palm Meadows, Varthur Road', city: 'Bengaluru', state: 'Karnataka', zipCode: '560066' },
    createdAt: new Date('2024-02-15T09:00:00.000Z'),
  });
  const docOrthoSenior = await ensureDoctor(doc3User, orthoDept, {
    specialization: 'Joint Replacement & Spine Surgery',
    qualification: ['MS (Orthopedics)', 'MCh (Ortho)', 'Fellowship Arthroplasty'],
    consultationFee: 1100,
    availability: [
      { day: 'monday', startTime: '08:30', endTime: '14:30' },
      { day: 'tuesday', startTime: '08:30', endTime: '14:30' },
      { day: 'wednesday', startTime: '08:30', endTime: '14:30' },
      { day: 'thursday', startTime: '08:30', endTime: '14:30' },
      { day: 'friday', startTime: '08:30', endTime: '14:30' },
      { day: 'saturday', startTime: '09:00', endTime: '13:00' },
    ],
    leaves: [
      {
        startDate: upcomingTue,
        endDate: upcomingTue,
        reason: 'Scheduled Orthopedic Surgery Conference & Arthroscopy Training',
      },
    ],
    rating: 4.9,
    reviewCount: 210,
    createdAt: new Date('2024-02-15T09:00:00.000Z'),
  });

  const doc3bUser = await ensureUser({
    firstName: 'Rohan',
    lastName: 'Deshmukh',
    email: 'dr.deshmukh@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0114',
    dob: new Date('1986-10-10T00:00:00.000Z'),
    gender: 'male',
    address: { street: '210, Sobha Carnation, Bellandur', city: 'Bengaluru', state: 'Karnataka', zipCode: '560103' },
    createdAt: new Date('2025-08-01T09:00:00.000Z'),
  });
  const docOrthoSports = await ensureDoctor(doc3bUser, orthoDept, {
    specialization: 'Sports Medicine & Arthroscopic Surgery',
    qualification: ['MS (Orthopedics)', 'Fellowship in Arthroscopy & Sports Rehab'],
    consultationFee: 950,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '16:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '16:00' },
      { day: 'wednesday', startTime: '14:00', endTime: '19:00' },
      { day: 'thursday', startTime: '09:00', endTime: '16:00' },
      { day: 'friday', startTime: '09:00', endTime: '16:00' },
      { day: 'saturday', startTime: '13:00', endTime: '18:00' },
    ],
    rating: 4.8,
    reviewCount: 88,
    createdAt: new Date('2025-08-01T09:00:00.000Z'),
  });

  // --- NEUROLOGY ---
  const doc4User = await ensureUser({
    firstName: 'Radhika',
    lastName: 'Menon',
    email: 'dr.menon@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0106',
    dob: new Date('1976-12-03T00:00:00.000Z'),
    gender: 'female',
    address: { street: '501, Embassy Boulevard, Bellary Road', city: 'Bengaluru', state: 'Karnataka', zipCode: '562157' },
    createdAt: new Date('2024-03-01T09:00:00.000Z'),
  });
  const docNeuro = await ensureDoctor(doc4User, neuroDept, {
    specialization: 'Neurology & Stroke Intervention',
    qualification: ['MD (Internal Med)', 'DM (Neurology)', 'Fellowship Neuro-Intervention'],
    consultationFee: 1300,
    availability: [
      { day: 'monday', startTime: '10:00', endTime: '16:00' },
      { day: 'tuesday', startTime: '10:00', endTime: '16:00' },
      { day: 'wednesday', startTime: '10:00', endTime: '16:00' },
      { day: 'thursday', startTime: '10:00', endTime: '16:00' },
      { day: 'friday', startTime: '10:00', endTime: '16:00' },
    ],
    rating: 4.9,
    reviewCount: 115,
    createdAt: new Date('2024-03-01T09:00:00.000Z'),
  });

  // --- GENERAL MEDICINE (2 Specialists) ---
  const doc5User = await ensureUser({
    firstName: 'Vedant',
    lastName: 'Mehta',
    email: 'dr.mehta@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0105',
    dob: new Date('1974-01-30T00:00:00.000Z'),
    gender: 'male',
    address: { street: '16, Brigade Millennium, JP Nagar 7th Phase', city: 'Bengaluru', state: 'Karnataka', zipCode: '560078' },
    createdAt: new Date('2024-03-15T09:00:00.000Z'),
  });
  const docMedSenior = await ensureDoctor(doc5User, genMedDept, {
    specialization: 'Internal Medicine & Critical Care',
    qualification: ['MBBS', 'MD (General Medicine)', 'FICCM'],
    consultationFee: 600,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '17:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '17:00' },
      { day: 'thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'friday', startTime: '09:00', endTime: '17:00' },
      { day: 'saturday', startTime: '09:00', endTime: '14:00' },
    ],
    rating: 4.8,
    reviewCount: 310,
    createdAt: new Date('2024-03-15T09:00:00.000Z'),
  });

  const doc5bUser = await ensureUser({
    firstName: 'Shalini',
    lastName: 'Pillai',
    email: 'dr.pillai@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0115',
    dob: new Date('1983-06-18T00:00:00.000Z'),
    gender: 'female',
    address: { street: '78, RMZ Galleria, Yelahanka', city: 'Bengaluru', state: 'Karnataka', zipCode: '560064' },
    createdAt: new Date('2025-09-20T09:00:00.000Z'),
  });
  const docMedDiabeto = await ensureDoctor(doc5bUser, genMedDept, {
    specialization: 'Diabetology & Metabolic Disorders',
    qualification: ['MD (General Medicine)', 'Post-Doctoral Fellowship Diabetology'],
    consultationFee: 650,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '15:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '15:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '15:00' },
      { day: 'thursday', startTime: '09:00', endTime: '15:00' },
      { day: 'friday', startTime: '09:00', endTime: '15:00' },
    ],
    rating: 4.7,
    reviewCount: 64,
    createdAt: new Date('2025-09-20T09:00:00.000Z'),
  });

  // --- DERMATOLOGY ---
  const doc6User = await ensureUser({
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'dr.nair@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0107',
    dob: new Date('1981-05-24T00:00:00.000Z'),
    gender: 'female',
    address: { street: '304, Divyasree Republic of Whitefield', city: 'Bengaluru', state: 'Karnataka', zipCode: '560066' },
    createdAt: new Date('2024-04-01T09:00:00.000Z'),
  });
  const docDerm = await ensureDoctor(doc6User, dermDept, {
    specialization: 'Clinical Dermatology & Laser Therapy',
    qualification: ['MD (DVL)', 'DNB (Dermatology)', 'Fellowship Dermatosurgery'],
    consultationFee: 700,
    availability: [
      { day: 'monday', startTime: '10:00', endTime: '17:00' },
      { day: 'tuesday', startTime: '10:00', endTime: '17:00' },
      { day: 'wednesday', startTime: '10:00', endTime: '17:00' },
      { day: 'thursday', startTime: '10:00', endTime: '17:00' },
      { day: 'friday', startTime: '10:00', endTime: '17:00' },
      { day: 'saturday', startTime: '10:00', endTime: '16:00' },
    ],
    rating: 4.9,
    reviewCount: 92,
    createdAt: new Date('2024-04-01T09:00:00.000Z'),
  });

  const docMedDiab = docMedDiabeto;
  const docNeuroSenior = docNeuro;
  const docPedsSenior = docPedsChief;

  // Link Department Heads
  cardioDept.head = docCardioSenior._id as mongoose.Types.ObjectId;
  await cardioDept.save();
  pedsDept.head = docPedsChief._id as mongoose.Types.ObjectId;
  await pedsDept.save();
  orthoDept.head = docOrthoSenior._id as mongoose.Types.ObjectId;
  await orthoDept.save();
  neuroDept.head = docNeuro._id as mongoose.Types.ObjectId;
  await neuroDept.save();
  genMedDept.head = docMedSenior._id as mongoose.Types.ObjectId;
  await genMedDept.save();
  dermDept.head = docDerm._id as mongoose.Types.ObjectId;
  await dermDept.save();

  // ---------------------------------------------------------------------------
  // 4. PATIENT POPULATION WITH DEEP IDENTITY REGISTRATION
  // ---------------------------------------------------------------------------
  const patientProfiles = [
    {
      user: {
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'patient1@pulsecare.test',
        phone: '+91-98765-0201',
        dob: new Date('1988-04-18T00:00:00.000Z'),
        gender: 'male' as const,
        address: { street: 'Flat 402, Green Glen Heights, Bellandur', city: 'Bengaluru', state: 'Karnataka', zipCode: '560103' },
      },
      createdAt: new Date('2025-11-10T10:00:00.000Z'),
      profile: {
        bloodGroup: 'O+' as const,
        allergies: ['Penicillin', 'Ampicillin'],
        emergencyContact: { name: 'Sunita Sharma', relationship: 'Mother', phone: '+91-98765-0202' },
        medicalHistory: [
          { condition: 'Essential Hypertension (Stage 2)', diagnosisDate: new Date('2022-04-10'), treatment: 'Daily ACE inhibitor therapy (Telmisartan 40mg)' },
          { condition: 'Mild Hyperlipidemia', diagnosisDate: new Date('2024-01-15'), treatment: 'Diet control & Statin therapy' },
        ],
        insuranceInfo: { provider: 'Star Health Premier Gold', policyNumber: 'SH-POL-883910', expiryDate: new Date('2027-08-31') },
      },
    },
    {
      user: {
        firstName: 'Diya',
        lastName: 'Patel',
        email: 'patient2@pulsecare.test',
        phone: '+91-98765-0203',
        dob: new Date('1993-09-22T00:00:00.000Z'),
        gender: 'female' as const,
        address: { street: '12-B, Shanti Niketan, Indiranagar', city: 'Bengaluru', state: 'Karnataka', zipCode: '560038' },
      },
      createdAt: new Date('2026-01-15T11:30:00.000Z'),
      profile: {
        bloodGroup: 'A+' as const,
        allergies: ['Peanuts', 'Sulfa drugs (Cotrimoxazole)'],
        emergencyContact: { name: 'Ramesh Patel', relationship: 'Father', phone: '+91-98765-0204' },
        medicalHistory: [
          { condition: 'Gestational Diabetes (Past)', diagnosisDate: new Date('2023-06-20'), notes: 'Post-delivery glucose tolerance normal' },
          { condition: 'Chronic Urticaria & Atopic Sensitization', diagnosisDate: new Date('2026-02-10'), treatment: 'Antihistamines & allergen avoidance' },
        ],
        insuranceInfo: { provider: 'HDFC ERGO Health Suraksha', policyNumber: 'HE-MED-554109', expiryDate: new Date('2027-11-15') },
      },
    },
    {
      user: {
        firstName: 'Rohan',
        lastName: 'Gupta',
        email: 'patient3@pulsecare.test',
        phone: '+91-98765-0205',
        dob: new Date('1974-08-14T00:00:00.000Z'),
        gender: 'male' as const,
        address: { street: '704, Prestige Palms, Whitefield', city: 'Bengaluru', state: 'Karnataka', zipCode: '560066' },
      },
      createdAt: new Date('2025-06-20T09:15:00.000Z'),
      profile: {
        bloodGroup: 'B-' as const,
        allergies: [], // NKDA (No Known Drug Allergies)
        emergencyContact: { name: 'Kavita Gupta', relationship: 'Spouse', phone: '+91-98765-0206' },
        medicalHistory: [
          { condition: 'Coronary Artery Disease (CAD - Post PTCA with DES stent to LAD)', diagnosisDate: new Date('2021-11-04'), treatment: 'Dual Antiplatelet Therapy (DAPT) & Beta-blocker' },
          { condition: 'Type 2 Diabetes Mellitus', diagnosisDate: new Date('2018-09-12'), treatment: 'Metformin 1000mg ER' },
          { condition: 'Elective Day-Care PTCA at PulseCare Cath Lab', diagnosisDate: new Date('2026-07-09'), treatment: 'DES Stent to LAD, excellent hemodynamic stability' },
        ],
        insuranceInfo: { provider: 'Max Bupa HeartBeat Platinum', policyNumber: 'MB-CRD-772911', expiryDate: new Date('2027-03-31') },
      },
    },
    {
      user: {
        firstName: 'Ananya',
        lastName: 'Deshmukh',
        email: 'patient4@pulsecare.test',
        phone: '+91-98765-0207',
        dob: new Date('1996-12-05T00:00:00.000Z'),
        gender: 'female' as const,
        address: { street: 'Plot 45, Koramangala 4th Block', city: 'Bengaluru', state: 'Karnataka', zipCode: '560034' },
      },
      createdAt: new Date('2026-01-08T14:00:00.000Z'),
      profile: {
        bloodGroup: 'AB+' as const,
        allergies: ['Latex', 'Radiological Contrast Dye'],
        emergencyContact: { name: 'Aditya Deshmukh', relationship: 'Brother', phone: '+91-98765-0208' },
        medicalHistory: [
          { condition: 'Moderate Persistent Bronchial Asthma', diagnosisDate: new Date('2019-02-18'), treatment: 'Inhaled Budesonide/Formoterol maintenance' },
          { condition: 'Complex Migraine with Visual Aura', diagnosisDate: new Date('2026-03-12'), treatment: 'Prophylactic Topiramate & lifestyle modification' },
        ],
        insuranceInfo: { provider: 'Care Health Advantage', policyNumber: 'CH-AST-112093', expiryDate: new Date('2027-05-20') },
      },
    },
    {
      user: {
        firstName: 'Kabir',
        lastName: 'Mehta',
        email: 'patient5@pulsecare.test',
        phone: '+91-98765-0209',
        dob: new Date('1965-11-03T00:00:00.000Z'),
        gender: 'male' as const,
        address: { street: 'B-201, Sobha Iris, Outer Ring Road', city: 'Bengaluru', state: 'Karnataka', zipCode: '560103' },
      },
      createdAt: new Date('2025-09-12T10:45:00.000Z'),
      profile: {
        bloodGroup: 'O-' as const,
        allergies: ['Aspirin', 'Ibuprofen', 'Naproxen (Severe NSAID-induced bronchospasm)'],
        emergencyContact: { name: 'Meera Mehta', relationship: 'Spouse', phone: '+91-98765-0210' },
        medicalHistory: [
          { condition: 'Severe Bilateral Knee Osteoarthritis (Grade 4 Kellgren-Lawrence)', diagnosisDate: new Date('2020-07-22'), treatment: 'Left Total Knee Arthroplasty performed September 2026' },
          { condition: 'Essential Hypertension', diagnosisDate: new Date('2022-01-14'), treatment: 'Amlodipine 5mg daily' },
        ],
        insuranceInfo: { provider: 'Niva Bupa ReAssure 2.0', policyNumber: 'NB-ORT-339182', expiryDate: new Date('2027-10-12') },
      },
    },
    {
      user: {
        firstName: 'Meera',
        lastName: 'Kapoor',
        email: 'patient6@pulsecare.test',
        phone: '+91-98765-0211',
        dob: new Date('1985-07-19T00:00:00.000Z'),
        gender: 'female' as const,
        address: { street: '55, Lavelle Road, Richmond Town', city: 'Bengaluru', state: 'Karnataka', zipCode: '560001' },
      },
      createdAt: new Date('2026-02-14T11:00:00.000Z'),
      profile: {
        bloodGroup: 'B+' as const,
        allergies: ['Amoxicillin-Clavulanate'],
        emergencyContact: { name: 'Vikram Kapoor', relationship: 'Spouse', phone: '+91-98765-0212' },
        medicalHistory: [
          { condition: 'Primary Hypothyroidism', diagnosisDate: new Date('2021-03-14'), treatment: 'Levothyroxine 75mcg daily fasting' },
          { condition: 'Chronic Migraine without aura', diagnosisDate: new Date('2023-08-09'), treatment: 'Propranolol prophylaxis' },
        ],
        insuranceInfo: { provider: 'Tata AIG Medicare Premier', policyNumber: 'TA-GEN-994102', expiryDate: new Date('2027-12-01') },
      },
    },
    {
      user: {
        firstName: 'Arjun',
        lastName: 'Rao',
        email: 'patient7@pulsecare.test',
        phone: '+91-98765-0213',
        dob: new Date('2020-03-12T00:00:00.000Z'), // 6-year-old pediatric child
        gender: 'male' as const,
        address: { street: 'Villa 18, Palm Meadows, Whitefield', city: 'Bengaluru', state: 'Karnataka', zipCode: '560066' },
      },
      createdAt: new Date('2026-03-01T15:20:00.000Z'),
      profile: {
        bloodGroup: 'A-' as const,
        allergies: ['Cow Milk Protein', 'Soy'],
        emergencyContact: { name: 'Srinivas Rao', relationship: 'Father (Legal Guardian)', phone: '+91-98765-0214' },
        medicalHistory: [
          { condition: 'Pediatric Atopic Dermatitis', diagnosisDate: new Date('2023-10-02'), treatment: 'Emollient therapy and topical barrier protection' },
          { condition: 'Childhood Reactive Airway / Asthma', diagnosisDate: new Date('2025-11-20'), treatment: 'Inhaled Budesonide via pediatric spacer' },
        ],
        insuranceInfo: { provider: 'Star Health Young Star Gold', policyNumber: 'SH-PED-991204', expiryDate: new Date('2027-08-15') },
      },
    },
    {
      user: {
        firstName: 'Sunita',
        lastName: 'Verma',
        email: 'patient8@pulsecare.test',
        phone: '+91-98765-0215',
        dob: new Date('1958-06-25T00:00:00.000Z'), // 68-year-old senior geriatric patient
        gender: 'female' as const,
        address: { street: 'Flat 102, Silver Oak Apts, Malleshwaram', city: 'Bengaluru', state: 'Karnataka', zipCode: '560003' },
      },
      createdAt: new Date('2025-04-10T09:30:00.000Z'),
      profile: {
        bloodGroup: 'AB-' as const,
        allergies: ['Morphine', 'Codeine (Opioid sensitivity)'],
        emergencyContact: { name: 'Deepak Verma', relationship: 'Son', phone: '+91-98765-0216' },
        medicalHistory: [
          { condition: 'Chronic Kidney Disease (CKD Stage 3a)', diagnosisDate: new Date('2020-01-19'), treatment: 'Nephrology dietary management & blood pressure control' },
          { condition: 'Senile Osteoporosis', diagnosisDate: new Date('2022-11-10'), treatment: 'Zoledronic acid annual infusion' },
        ],
        insuranceInfo: { provider: 'Senior Citizen Red Carpet Plan', policyNumber: 'SC-GER-665192', expiryDate: new Date('2027-04-18') },
      },
    },
    {
      user: {
        firstName: 'Karan',
        lastName: 'Singhania',
        email: 'patient9@pulsecare.test',
        phone: '+91-98765-0217',
        dob: new Date('1991-02-28T00:00:00.000Z'),
        gender: 'male' as const,
        address: { street: 'Penthouse 14, Brigade Gateway, Rajajinagar', city: 'Bengaluru', state: 'Karnataka', zipCode: '560055' },
      },
      createdAt: new Date('2026-02-20T16:10:00.000Z'),
      profile: {
        bloodGroup: 'O+' as const,
        allergies: [], // NKDA
        emergencyContact: { name: 'Ritu Singhania', relationship: 'Sister', phone: '+91-98765-0218' },
        medicalHistory: [
          { condition: 'Lumbar Disc Herniation (L4-L5)', diagnosisDate: new Date('2023-05-11'), treatment: 'Conservative physical therapy & core strengthening' },
        ],
        insuranceInfo: { provider: 'ICICI Lombard Health Care', policyNumber: 'IL-ORT-812034', expiryDate: new Date('2027-07-25') },
      },
    },
    {
      user: {
        firstName: 'Fatima',
        lastName: 'Khan',
        email: 'patient10@pulsecare.test',
        phone: '+91-98765-0219',
        dob: new Date('1998-10-14T00:00:00.000Z'),
        gender: 'female' as const,
        address: { street: '88, Cooke Town Main Road, Frazer Town', city: 'Bengaluru', state: 'Karnataka', zipCode: '560005' },
      },
      createdAt: new Date('2026-01-25T12:00:00.000Z'),
      profile: {
        bloodGroup: 'B+' as const,
        allergies: ['Ciprofloxacin', 'Fluoroquinolones'],
        emergencyContact: { name: 'Zainab Khan', relationship: 'Mother', phone: '+91-98765-0220' },
        medicalHistory: [
          { condition: 'Polycystic Ovarian Syndrome (PCOS)', diagnosisDate: new Date('2022-08-25'), treatment: 'Lifestyle modification and Inositol supplement' },
          { condition: 'Sebaceous Cyst (Facial - Excised Aug 2026)', diagnosisDate: new Date('2026-07-15'), treatment: 'Surgical excision biopsy with clean margins' },
        ],
        insuranceInfo: { provider: 'Bajaj Allianz Health Guard', policyNumber: 'BA-GYN-442109', expiryDate: new Date('2027-09-30') },
      },
    },
  ];

  const patients: HydratedDocument<IPatient>[] = [];
  for (const item of patientProfiles) {
    const u = await ensureUser({
      ...item.user,
      role: 'patient',
      createdAt: item.createdAt,
    });
    let p = await Patient.findOne({ userId: u._id });
    if (!p) {
      p = new Patient({
        userId: u._id,
        bloodGroup: item.profile.bloodGroup,
        allergies: item.profile.allergies,
        emergencyContact: item.profile.emergencyContact,
        medicalHistory: item.profile.medicalHistory,
        insuranceInfo: item.profile.insuranceInfo,
      });
      if (item.createdAt) {
        p.createdAt = item.createdAt;
        p.updatedAt = item.createdAt;
      }
      await p.save();
    } else {
      p.bloodGroup = item.profile.bloodGroup;
      p.allergies = item.profile.allergies;
      p.emergencyContact = item.profile.emergencyContact;
      p.medicalHistory = item.profile.medicalHistory;
      p.insuranceInfo = item.profile.insuranceInfo;
      await p.save();
    }
    if (item.createdAt) {
      await Patient.updateOne(
        { _id: p._id },
        { $set: { createdAt: item.createdAt, updatedAt: item.createdAt } }
      );
      p.createdAt = item.createdAt;
      p.updatedAt = item.createdAt;
    }
    patients.push(p);
  }

  // ---------------------------------------------------------------------------
  // 5. APPOINTMENTS WITH SEQUENTIAL QUEUE TOKENS (#1, #2, #3, ...) & ZERO DOUBLE-BOOKING
  // ---------------------------------------------------------------------------
  const now = new Date();
  const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const yesterdayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
  const threeDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3, 0, 0, 0, 0));
  const fiveDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 5, 0, 0, 0, 0));

  const nextMonday = getWeekdayDate('monday', 1);
  const nextTuesday = getWeekdayDate('tuesday', 1);
  const nextWednesday = getWeekdayDate('wednesday', 1);
  const nextThursday = getWeekdayDate('thursday', 1);
  const nextFriday = getWeekdayDate('friday', 1);

  const appointmentDefinitions = [
    // === ACTIVE DAILY QUEUE TODAY: CARDIOLOGY (Dr. Arvind Sharma) ===
    {
      key: 'today_cardio_aarav',
      patient: patients[0], // Aarav Sharma
      doctor: docCardioSenior,
      date: todayDate,
      timeSlot: '09:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Chest tightness evaluation & ECG review',
      notes: 'BP 138/88 mmHg. ECG shows normal sinus rhythm. Prescribed 30-day statin and lifestyle counseling.',
      createdAt: todayDate,
    },
    {
      key: 'today_cardio_diya',
      patient: patients[1], // Diya Patel
      doctor: docCardioSenior,
      date: todayDate,
      timeSlot: '09:30',
      status: 'inProgress' as const,
      type: 'consultation' as const,
      reason: 'Hypertension follow-up & cardiac screening',
      notes: 'Patient currently undergoing vitals assessment in chamber.',
      createdAt: todayDate,
    },
    {
      key: 'today_cardio_rohan',
      patient: patients[2], // Rohan Gupta
      doctor: docCardioSenior,
      date: todayDate,
      timeSlot: '10:00',
      status: 'confirmed' as const,
      type: 'follow-up' as const,
      reason: 'Post-PTCA annual cardiac checkup & Doppler evaluation',
      createdAt: todayDate,
    },
    {
      key: 'today_cardio_ananya',
      patient: patients[3], // Ananya Deshmukh
      doctor: docCardioSenior,
      date: todayDate,
      timeSlot: '10:30',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Palpitations upon exertion & Holter study inquiry',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: CARDIOLOGY JUNIOR (Dr. Vikram Iyer) ===
    {
      key: 'today_cardio_kabir',
      patient: patients[4], // Kabir Mehta
      doctor: docCardioJunior,
      date: todayDate,
      timeSlot: '13:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Holter monitoring review for premature ventricular contractions',
      notes: 'Holter report demonstrates benign PVCs. Reassurance provided.',
      createdAt: todayDate,
    },
    {
      key: 'today_cardio_meera',
      patient: patients[5], // Meera Kapoor
      doctor: docCardioJunior,
      date: todayDate,
      timeSlot: '13:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Resting pulse irregularity & stress test evaluation',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: ORTHOPEDICS (Dr. Rajesh Patel) ===
    {
      key: 'today_ortho_kabir',
      patient: patients[4], // Kabir Mehta
      doctor: docOrthoSenior,
      date: todayDate,
      timeSlot: '08:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Bilateral knee joint aspiration & cortisone injection',
      notes: 'Synovial fluid clear. Successfully administered 40mg Depo-Medrol per joint.',
      createdAt: todayDate,
    },
    {
      key: 'today_ortho_karan',
      patient: patients[8], // Karan Singhania
      doctor: docOrthoSenior,
      date: todayDate,
      timeSlot: '09:00',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Lumbar radiculopathy & severe lower back stiffness',
      createdAt: todayDate,
    },
    {
      key: 'today_ortho_sunita',
      patient: patients[7], // Sunita Verma
      doctor: docOrthoSenior,
      date: todayDate,
      timeSlot: '09:30',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Osteoporosis DEXA scan review & joint mobility check',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: SPORTS ORTHOPEDICS (Dr. Rohan Deshmukh) ===
    {
      key: 'today_sports_karan',
      patient: patients[8], // Karan Singhania
      doctor: docOrthoSports,
      date: todayDate,
      timeSlot: '10:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Post-physiotherapy spinal range-of-motion testing',
      notes: 'Flexion and extension within normal functional limits. Advised core Pilates regimen.',
      createdAt: todayDate,
    },
    {
      key: 'today_sports_aarav',
      patient: patients[0], // Aarav Sharma
      doctor: docOrthoSports,
      date: todayDate,
      timeSlot: '10:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Running gait assessment & patellar tendonitis screening',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: PEDIATRICS (Dr. Sneha Kulkarni) ===
    {
      key: 'today_peds_arjun',
      patient: patients[6], // Child Arjun Rao
      doctor: docPedsChief,
      date: todayDate,
      timeSlot: '09:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Pediatric eczema flare-up & 6-year immunization',
      notes: 'Administered DTaP/IPV booster. Prescribed non-steroidal topical barrier cream.',
      createdAt: todayDate,
    },
    {
      key: 'today_peds_diya',
      patient: patients[1], // Diya Patel
      doctor: docPedsChief,
      date: todayDate,
      timeSlot: '09:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Pediatric nutrition & early childhood developmental milestones consultation',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: PEDIATRIC PULMONOLOGY (Dr. Ananya Mukherjee) ===
    {
      key: 'today_pulmo_arjun',
      patient: patients[6], // Arjun Rao
      doctor: docPedsPulmo,
      date: todayDate,
      timeSlot: '11:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Pediatric bronchodilator reversibility nebulization trial',
      notes: 'Peak flow improved by 18% post-salbutamol inhalation. Good response.',
      createdAt: todayDate,
    },
    {
      key: 'today_pulmo_fatima',
      patient: patients[9], // Fatima Khan
      doctor: docPedsPulmo,
      date: todayDate,
      timeSlot: '12:00',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Seasonal allergic rhinitis and nocturnal wheeze consultation',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: NEUROLOGY (Dr. Radhika Menon) ===
    {
      key: 'today_neuro_ananya',
      patient: patients[3], // Ananya Deshmukh
      doctor: docNeuro,
      date: todayDate,
      timeSlot: '10:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Complex migraine headache aura tracking & medication review',
      notes: 'Headache diary reviewed. Zero visual scotomas during past 14 days on Topiramate.',
      createdAt: todayDate,
    },
    {
      key: 'today_neuro_meera',
      patient: patients[5], // Meera Kapoor
      doctor: docNeuro,
      date: todayDate,
      timeSlot: '10:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Unilateral chronic cephalalgia & sleep quality evaluation',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: GENERAL MEDICINE (Dr. Vedant Mehta) ===
    {
      key: 'today_med_sunita',
      patient: patients[7], // Sunita Verma
      doctor: docMedSenior,
      date: todayDate,
      timeSlot: '09:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Geriatric CKD blood pressure & electrolyte follow-up',
      notes: 'BP 128/80 mmHg. Serum creatinine 1.40 mg/dL. Renal function stable.',
      createdAt: todayDate,
    },
    {
      key: 'today_med_aarav',
      patient: patients[0], // Aarav Sharma
      doctor: docMedSenior,
      date: todayDate,
      timeSlot: '10:00',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Essential hypertension Telmisartan dosage titration',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: DIABETOLOGY (Dr. Shalini Pillai) ===
    {
      key: 'today_diab_rohan',
      patient: patients[2], // Rohan Gupta
      doctor: docMedDiab,
      date: todayDate,
      timeSlot: '10:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Continuous glucose monitor (CGM) sensor download & HbA1c review',
      notes: 'Time in range (70-180 mg/dL): 84%. Fasting blood glucose 112 mg/dL. Well controlled.',
      createdAt: todayDate,
    },
    {
      key: 'today_diab_meera',
      patient: patients[5], // Meera Kapoor
      doctor: docMedDiab,
      date: todayDate,
      timeSlot: '10:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Thyroid hormone stabilization & metabolic panel checkup',
      createdAt: todayDate,
    },

    // === ACTIVE DAILY QUEUE TODAY: DERMATOLOGY (Dr. Priya Nair) ===
    {
      key: 'today_derm_fatima',
      patient: patients[9], // Fatima Khan
      doctor: docDerm,
      date: todayDate,
      timeSlot: '10:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Post-surgical sebaceous cyst excision wound inspection',
      notes: 'Surgical scar remodeling cleanly. No erythema or induration. Apply silicone gel.',
      createdAt: todayDate,
    },
    {
      key: 'today_derm_diya',
      patient: patients[1], // Diya Patel
      doctor: docDerm,
      date: todayDate,
      timeSlot: '11:00',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Chronic contact urticaria follow-up & moisturizer trial',
      createdAt: todayDate,
    },

    // === RECENT PAST DAYS (Yesterday & Past Week) ===
    {
      key: 'past_yesterday_cardio_rohan',
      patient: patients[2], // Rohan Gupta
      doctor: docCardioSenior,
      date: yesterdayDate,
      timeSlot: '11:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Post-exercise electrocardiogram evaluation',
      notes: 'Treadmill stress test negative for inducible myocardial ischemia.',
      createdAt: yesterdayDate,
    },
    {
      key: 'past_3days_ortho_kabir',
      patient: patients[4], // Kabir Mehta
      doctor: docOrthoSenior,
      date: threeDaysAgo,
      timeSlot: '10:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Post-operative knee rehabilitation ultrasound scan',
      notes: 'Quadriceps activation symmetric. Zero intra-articular fluid collection.',
      createdAt: threeDaysAgo,
    },
    {
      key: 'past_5days_med_sunita',
      patient: patients[7], // Sunita Verma
      doctor: docMedSenior,
      date: fiveDaysAgo,
      timeSlot: '11:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Geriatric electrolyte and hydration status review',
      notes: 'Serum sodium 138 mEq/L, potassium 4.4 mEq/L. Fluid balance maintained.',
      createdAt: fiveDaysAgo,
    },
    {
      key: 'past_cancel_cardio_meera',
      patient: patients[5], // Meera Kapoor
      doctor: docCardioSenior,
      date: fiveDaysAgo,
      timeSlot: '12:00',
      status: 'cancelled' as const,
      type: 'consultation' as const,
      reason: 'Cardiovascular wellness screening',
      cancelReason: 'Patient had family travel conflict - rescheduled to tele-triage',
      createdAt: fiveDaysAgo,
    },
    {
      key: 'past_noshow_med_fatima',
      patient: patients[9], // Fatima Khan
      doctor: docMedSenior,
      date: threeDaysAgo,
      timeSlot: '14:00',
      status: 'noShow' as const,
      type: 'consultation' as const,
      reason: 'General medicine annual wellness panel',
      notes: 'Patient did not arrive within 30 minutes of appointment window.',
      createdAt: threeDaysAgo,
    },

    // === HISTORICAL MULTI-MONTH APPOINTMENTS (JULY, AUGUST, SEPTEMBER 2026) ===
    // --- JULY 2026 ---
    {
      key: 'past_july_cardio_rohan',
      patient: patients[2], // Rohan Gupta
      doctor: docCardioSenior,
      date: new Date('2026-07-08T09:00:00.000Z'),
      timeSlot: '09:00',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Post-angioplasty 6-month coronary follow-up & ECG',
      notes: 'ECG stable. Exercise tolerance test normal. Scheduled elective PTCA check.',
      createdAt: new Date('2026-07-05T09:00:00.000Z'),
    },
    {
      key: 'past_july_neuro_ananya',
      patient: patients[3], // Ananya Deshmukh
      doctor: docNeuro,
      date: new Date('2026-07-08T10:30:00.000Z'),
      timeSlot: '10:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Migraine prophylaxis review & EEG',
      notes: 'Migraine frequency reduced from 6 to 2 per month on Topiramate.',
      createdAt: new Date('2026-07-06T10:00:00.000Z'),
    },
    {
      key: 'past_july_diab_fatima',
      patient: patients[9], // Fatima Khan
      doctor: docMedDiab,
      date: new Date('2026-07-08T09:30:00.000Z'),
      timeSlot: '09:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Diabetic metabolic screening & insulin titration',
      notes: 'Fasting glucose 118 mg/dL. HbA1c 6.8%. Diet plan reinforced.',
      createdAt: new Date('2026-07-06T11:00:00.000Z'),
    },
    {
      key: 'past_july_peds_arjun',
      patient: patients[6], // Arjun Rao
      doctor: docPedsChief,
      date: new Date('2026-07-09T10:00:00.000Z'),
      timeSlot: '10:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Pediatric wellness screening & allergy profile',
      notes: 'Child growing along 65th percentile. Vaccinations updated.',
      createdAt: new Date('2026-07-07T14:00:00.000Z'),
    },
    {
      key: 'past_july_ortho_kabir',
      patient: patients[4], // Kabir Mehta
      doctor: docOrthoSenior,
      date: new Date('2026-07-15T11:00:00.000Z'),
      timeSlot: '11:00',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Diagnostic knee arthroscopy evaluation',
      notes: 'Grade 3 medial compartment osteoarthritis verified.',
      createdAt: new Date('2026-07-12T10:00:00.000Z'),
    },
    {
      key: 'past_july_med_sunita',
      patient: patients[7], // Sunita Verma
      doctor: docMedSenior,
      date: new Date('2026-07-15T14:00:00.000Z'),
      timeSlot: '14:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Geriatric hypertension and renal screening',
      notes: 'Blood pressure 130/82 mmHg. Renal parameters monitored.',
      createdAt: new Date('2026-07-13T09:30:00.000Z'),
    },
    {
      key: 'past_july_derm_diya',
      patient: patients[1], // Diya Patel
      doctor: docDerm,
      date: new Date('2026-07-23T11:30:00.000Z'),
      timeSlot: '11:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Allergic contact dermatitis patch testing',
      notes: 'Positive reaction to nickel sulfate. Prescribed barrier moisturizer.',
      createdAt: new Date('2026-07-20T10:00:00.000Z'),
    },
    {
      key: 'past_july_sports_karan',
      patient: patients[8], // Karan Singhania
      doctor: docOrthoSports,
      date: new Date('2026-07-28T14:30:00.000Z'),
      timeSlot: '14:30',
      status: 'cancelled' as const,
      type: 'consultation' as const,
      reason: 'Lumbar spine sports rehabilitation initial assessment',
      cancelReason: 'Patient travelling out of state for family emergency',
      createdAt: new Date('2026-07-25T11:00:00.000Z'),
    },

    // --- AUGUST 2026 ---
    {
      key: 'past_aug_neuro_ananya',
      patient: patients[3], // Ananya Deshmukh
      doctor: docNeuro,
      date: new Date('2026-08-05T10:30:00.000Z'),
      timeSlot: '10:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Brain MRI with contrast review & neurological clearance',
      notes: 'Brain parenchyma intact. No acute infarct or focal lesions.',
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    },
    {
      key: 'past_aug_cardio_rohan',
      patient: patients[2], // Rohan Gupta
      doctor: docCardioSenior,
      date: new Date('2026-08-05T09:30:00.000Z'),
      timeSlot: '09:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Stress echocardiography & lipid management review',
      notes: 'Good exercise capacity. LDL 68 mg/dL target achieved.',
      createdAt: new Date('2026-08-02T11:00:00.000Z'),
    },
    {
      key: 'past_aug_ortho_kabir',
      patient: patients[4], // Kabir Mehta
      doctor: docOrthoSenior,
      date: new Date('2026-08-12T11:00:00.000Z'),
      timeSlot: '11:00',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Pre-surgical joint injection & range of motion analysis',
      notes: 'Joint effusion cleared. Motion range 10-95 degrees.',
      createdAt: new Date('2026-08-09T09:00:00.000Z'),
    },
    {
      key: 'past_aug_derm_fatima',
      patient: patients[9], // Fatima Khan
      doctor: docDerm,
      date: new Date('2026-08-13T14:00:00.000Z'),
      timeSlot: '14:00',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Sebaceous cyst excision biopsy',
      notes: 'Excision performed under local anesthesia. Specimen sent for histopathology.',
      createdAt: new Date('2026-08-10T12:00:00.000Z'),
    },
    {
      key: 'past_aug_peds_arjun',
      patient: patients[6], // Arjun Rao
      doctor: docPedsChief,
      date: new Date('2026-08-20T09:30:00.000Z'),
      timeSlot: '09:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Pediatric acute bronchitis treatment review',
      notes: 'Chest clear bilaterally. Bronchospasm fully resolved.',
      createdAt: new Date('2026-08-17T14:00:00.000Z'),
    },
    {
      key: 'past_aug_cardio_meera',
      patient: patients[5], // Meera Kapoor
      doctor: docCardioJunior,
      date: new Date('2026-08-19T13:00:00.000Z'),
      timeSlot: '13:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Palpitation evaluation & 24h Holter analysis',
      notes: 'Holter shows occasional premature atrial contractions, benign.',
      createdAt: new Date('2026-08-16T10:00:00.000Z'),
    },
    {
      key: 'past_aug_med_sunita',
      patient: patients[7], // Sunita Verma
      doctor: docMedSenior,
      date: new Date('2026-08-19T10:00:00.000Z'),
      timeSlot: '10:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Renal function monitoring & dose adjustments',
      notes: 'Serum creatinine 1.4 mg/dL. Stable on current regimen.',
      createdAt: new Date('2026-08-16T11:00:00.000Z'),
    },
    {
      key: 'past_aug_diab_aarav',
      patient: patients[0], // Aarav Sharma
      doctor: docMedDiab,
      date: new Date('2026-08-26T14:30:00.000Z'),
      timeSlot: '14:30',
      status: 'noShow' as const,
      type: 'consultation' as const,
      reason: 'Routine fasting blood sugar checkup',
      notes: 'Patient did not arrive at appointment desk within allocated time.',
      createdAt: new Date('2026-08-23T09:00:00.000Z'),
    },

    // --- SEPTEMBER 2026 ---
    {
      key: 'past_sep_ortho_kabir',
      patient: patients[4], // Kabir Mehta
      doctor: docOrthoSenior,
      date: new Date('2026-09-02T08:30:00.000Z'),
      timeSlot: '08:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Robotic-assisted Total Knee Replacement surgical admission',
      notes: 'TKR completed without complications. Implant alignment verified on fluoroscopy.',
      createdAt: new Date('2026-08-28T09:00:00.000Z'),
    },
    {
      key: 'past_sep_cardio_rohan',
      patient: patients[2], // Rohan Gupta
      doctor: docCardioSenior,
      date: new Date('2026-09-02T11:30:00.000Z'),
      timeSlot: '11:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Quarterly cardiovascular health audit',
      notes: 'Resting ECG sinus rhythm 72 bpm. Medication adherence 100%.',
      createdAt: new Date('2026-08-29T10:00:00.000Z'),
    },
    {
      key: 'past_sep_pulmo_arjun',
      patient: patients[6], // Arjun Rao
      doctor: docPedsPulmo,
      date: new Date('2026-09-09T11:00:00.000Z'),
      timeSlot: '11:00',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Pediatric asthma spirometry study',
      notes: 'FEV1/FVC ratio 82%. Well controlled on low-dose inhaled corticosteroids.',
      createdAt: new Date('2026-09-05T14:00:00.000Z'),
    },
    {
      key: 'past_sep_sports_karan',
      patient: patients[8], // Karan Singhania
      doctor: docOrthoSports,
      date: new Date('2026-09-09T14:00:00.000Z'),
      timeSlot: '14:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Post-physiotherapy spinal mobility review',
      notes: 'Straight leg raise test negative bilaterally. Pain VAS score reduced from 8 to 2.',
      createdAt: new Date('2026-09-06T11:00:00.000Z'),
    },
    {
      key: 'past_sep_med_diya',
      patient: patients[1], // Diya Patel
      doctor: docMedSenior,
      date: new Date('2026-09-16T09:30:00.000Z'),
      timeSlot: '09:30',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Acute fever workup & executive health screening',
      notes: 'Viral fever resolved. General blood profile within normal limits.',
      createdAt: new Date('2026-09-13T10:00:00.000Z'),
    },
    {
      key: 'past_sep_diab_meera',
      patient: patients[5], // Meera Kapoor
      doctor: docMedDiab,
      date: new Date('2026-09-16T11:00:00.000Z'),
      timeSlot: '11:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Thyroid hormone titration & HbA1c screening',
      notes: 'TSH normalized to 2.4 mIU/L on Levothyroxine 50 mcg.',
      createdAt: new Date('2026-09-14T09:00:00.000Z'),
    },
    {
      key: 'past_sep_neuro_ananya',
      patient: patients[3], // Ananya Deshmukh
      doctor: docNeuro,
      date: new Date('2026-09-23T10:30:00.000Z'),
      timeSlot: '10:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Routine EEG baseline recording',
      notes: 'Normal awake and drowsy EEG. No epileptiform discharges.',
      createdAt: new Date('2026-09-20T10:00:00.000Z'),
    },
    {
      key: 'past_sep_derm_fatima',
      patient: patients[9], // Fatima Khan
      doctor: docDerm,
      date: new Date('2026-09-24T14:00:00.000Z'),
      timeSlot: '14:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Cosmetic laser follow-up & scar remodeling',
      notes: 'Good wound healing. Prescribed silicone scar gel.',
      createdAt: new Date('2026-09-21T11:00:00.000Z'),
    },
    {
      key: 'past_sep_cardio_aarav',
      patient: patients[0], // Aarav Sharma
      doctor: docCardioJunior,
      date: new Date('2026-09-30T13:00:00.000Z'),
      timeSlot: '13:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Pre-marathon athletic cardiac clearance',
      notes: 'Resting pulse 58 bpm. Normal cardiovascular examination.',
      createdAt: new Date('2026-09-27T10:00:00.000Z'),
    },
    {
      key: 'past_sep_med_sunita',
      patient: patients[7], // Sunita Verma
      doctor: docMedSenior,
      date: new Date('2026-09-30T11:00:00.000Z'),
      timeSlot: '11:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Geriatric bone health & osteoporosis infusion review',
      notes: 'Zoledronic acid annual review completed. Advised Vitamin D3 supplement.',
      createdAt: new Date('2026-09-27T11:30:00.000Z'),
    },

    // === UPCOMING FUTURE APPOINTMENTS (Next Week) ===
    {
      key: 'future_neuro_ananya',
      patient: patients[3],
      doctor: docNeuro,
      date: nextMonday,
      timeSlot: '10:00',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Recurrent atypical tension headache & visual aura investigation',
      createdAt: todayDate,
    },
    {
      key: 'future_derm_fatima',
      patient: patients[9],
      doctor: docDerm,
      date: nextTuesday,
      timeSlot: '10:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Persistent facial rosacea & patch allergy study',
      createdAt: todayDate,
    },
    {
      key: 'future_sports_karan',
      patient: patients[8],
      doctor: docOrthoSports,
      date: nextWednesday,
      timeSlot: '14:00',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Post-physiotherapy MRI lumbar spine evaluation',
      createdAt: todayDate,
    },
  ];

  const appointmentMap = new Map<string, HydratedDocument<any>>();
  const createdAppointments: HydratedDocument<any>[] = [];
  for (const def of appointmentDefinitions) {
    let appt = await Appointment.findOne({
      doctor: def.doctor._id,
      date: def.date,
      timeSlot: def.timeSlot,
    });
    if (!appt) {
      appt = new Appointment({
        patient: def.patient._id,
        doctor: def.doctor._id,
        department: def.doctor.department,
        date: def.date,
        timeSlot: def.timeSlot,
        status: def.status,
        type: def.type,
        reason: def.reason,
        notes: def.notes,
        cancelReason: def.cancelReason,
        createdBy: adminUser._id,
      });
      await appt.save();
    } else {
      appt.patient = def.patient._id;
      appt.status = def.status;
      appt.type = def.type;
      appt.reason = def.reason;
      appt.notes = def.notes;
      appt.cancelReason = def.cancelReason;
      await appt.save();
    }
    const apptCreatedAt = def.createdAt || def.date;
    if (apptCreatedAt) {
      await Appointment.updateOne(
        { _id: appt._id },
        { $set: { createdAt: apptCreatedAt, updatedAt: apptCreatedAt } }
      );
      appt.createdAt = apptCreatedAt;
    }
    if (def.key) {
      appointmentMap.set(def.key, appt);
    }
    createdAppointments.push(appt);
  }

  // ---------------------------------------------------------------------------
  // 6. PHARMACY DRUGS (With Critical Low-Stock Alerts!)
  // ---------------------------------------------------------------------------
  const drugFormulary = [
    { name: 'Atorvastatin 20mg Tablets', code: 'DRG-ATV-20', category: 'Cardiovascular', unit: 'Tablet', stockQuantity: 340, reorderLevel: 50, description: 'HMG-CoA reductase inhibitor for dyslipidemia' },
    { name: 'Telmisartan 40mg Tablets', code: 'DRG-TEL-40', category: 'Cardiovascular', unit: 'Tablet', stockQuantity: 410, reorderLevel: 60, description: 'Angiotensin II receptor antagonist for hypertension' },
    { name: 'Metoprolol Succinate 25mg ER', code: 'DRG-MET-25', category: 'Cardiovascular', unit: 'Tablet', stockQuantity: 280, reorderLevel: 40, description: 'Cardioselective beta-1 adrenergic blocker' },
    { name: 'Amoxicillin-Clavulanate 625mg', code: 'DRG-AMC-625', category: 'Antibiotics', unit: 'Tablet', stockQuantity: 18, reorderLevel: 50, description: 'Broad-spectrum beta-lactam antibiotic (LOW STOCK ALERT!)' },
    { name: 'Azithromycin 500mg Tablets', code: 'DRG-AZI-500', category: 'Antibiotics', unit: 'Tablet', stockQuantity: 95, reorderLevel: 30, description: 'Macrolide antibiotic for respiratory tract infections' },
    { name: 'Metformin 500mg SR Tablets', code: 'DRG-MET-500', category: 'Antidiabetic', unit: 'Tablet', stockQuantity: 580, reorderLevel: 100, description: 'Biguanide antihyperglycemic agent for T2D' },
    { name: 'Glucosamine + Chondroitin Complex', code: 'DRG-GLU-500', category: 'Orthopedics', unit: 'Tablet', stockQuantity: 120, reorderLevel: 30, description: 'Cartilage support nutritional supplement' },
    { name: 'Budesonide 200mcg Rotacaps', code: 'DRG-BUD-200', category: 'Respiratory', unit: 'Capsule', stockQuantity: 14, reorderLevel: 40, description: 'Inhaled corticosteroid for asthma (LOW STOCK ALERT!)' },
    { name: 'Paracetamol 650mg Tablets', code: 'DRG-PCM-650', category: 'Analgesics', unit: 'Tablet', stockQuantity: 1250, reorderLevel: 200, description: 'Antipyretic and analgesic tablet' },
    { name: 'Levothyroxine 75mcg Tablets', code: 'DRG-THY-75', category: 'Endocrine', unit: 'Tablet', stockQuantity: 210, reorderLevel: 50, description: 'Synthetic thyroid hormone for hypothyroidism' },
  ];

  const createdDrugs: HydratedDocument<any>[] = [];
  for (const item of drugFormulary) {
    let d = await Drug.findOne({ code: item.code });
    if (!d) {
      d = new Drug(item);
      await d.save();
    } else {
      d.stockQuantity = item.stockQuantity;
      d.reorderLevel = item.reorderLevel;
      await d.save();
    }
    createdDrugs.push(d);
  }

  // ---------------------------------------------------------------------------
  // 7. INVENTORY ITEMS & SURGICAL CONSUMABLES
  // ---------------------------------------------------------------------------
  const hospitalInventory = [
    { name: 'Sterile Surgical Gloves 7.5', code: 'INV-GLV-75', category: 'Surgical Consumables', quantity: 480, unit: 'Pairs', reorderLevel: 100, supplier: 'Ansell Healthcare' },
    { name: 'IV Cannula 20G (Pink)', code: 'INV-CAN-20G', category: 'Infusion Supplies', quantity: 320, unit: 'Pieces', reorderLevel: 60, supplier: 'B. Braun Medical' },
    { name: 'N95 Particulate Respirator Masks', code: 'INV-MSK-N95', category: 'PPE Supplies', quantity: 12, unit: 'Boxes', reorderLevel: 30, supplier: '3M Healthcare (LOW STOCK!)' },
    { name: 'Disposable Syringes 5ml with 23G Needle', code: 'INV-SYR-5ML', category: 'Infusion Supplies', quantity: 850, unit: 'Pieces', reorderLevel: 200, supplier: 'BD Medical' },
    { name: 'ECG Thermal Recording Paper Z-Fold', code: 'INV-ECG-PPR', category: 'Diagnostics', quantity: 42, unit: 'Rolls', reorderLevel: 15, supplier: 'GE Healthcare' },
    { name: 'Sterile Normal Saline 0.9% 500ml', code: 'INV-IVF-NS', category: 'Infusion Fluids', quantity: 210, unit: 'Bottles', reorderLevel: 50, supplier: 'Baxter India' },
  ];

  const createdInventoryItems: HydratedDocument<any>[] = [];
  for (const item of hospitalInventory) {
    let inv = await InventoryItem.findOne({ code: item.code });
    if (!inv) {
      inv = new InventoryItem(item);
      await inv.save();
    } else {
      inv.quantity = item.quantity;
      inv.reorderLevel = item.reorderLevel;
      await inv.save();
    }
    createdInventoryItems.push(inv);
  }

  // Historical Stock Movements (July, August, September 2026)
  if (createdInventoryItems.length >= 4) {
    const stockMovements = [
      { itemId: createdInventoryItems[0]._id, type: 'in' as const, quantity: 200, previousQuantity: 280, newQuantity: 480, reason: 'Bulk Q3 supplier delivery received', performedBy: adminUser._id, createdAt: new Date('2026-07-10T10:00:00.000Z') },
      { itemId: createdInventoryItems[1]._id, type: 'out' as const, quantity: 40, previousQuantity: 360, newQuantity: 320, reason: 'Department requisition - ICU Ward A', performedBy: adminUser._id, createdAt: new Date('2026-08-14T11:30:00.000Z') },
      { itemId: createdInventoryItems[2]._id, type: 'out' as const, quantity: 18, previousQuantity: 30, newQuantity: 12, reason: 'Infection Control Unit distribution', performedBy: adminUser._id, createdAt: new Date('2026-09-05T09:15:00.000Z') },
      { itemId: createdInventoryItems[3]._id, type: 'in' as const, quantity: 300, previousQuantity: 550, newQuantity: 850, reason: 'Monthly stock replenishment', performedBy: adminUser._id, createdAt: new Date('2026-09-20T14:00:00.000Z') },
    ];
    for (const sm of stockMovements) {
      const exists = await StockMovement.findOne({ itemId: sm.itemId, createdAt: sm.createdAt });
      if (!exists) {
        await StockMovement.create(sm);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. PRESCRIPTIONS LINKED TO CLINICAL CONSULTATIONS
  // ---------------------------------------------------------------------------
  const prescriptionsData = [
    // Today's Cardiology prescription for Rohan Gupta (linked to his appointment today)
    {
      patientId: patients[2]._id,
      doctorId: docCardioSenior._id,
      appointmentId: appointmentMap.get('today_cardio_rohan')?._id,
      lineItems: [
        { drugId: createdDrugs[0]._id, drugName: createdDrugs[0].name, dosage: '20mg', frequency: 'Once daily at bedtime', duration: '30 days', quantity: 30 },
        { drugId: createdDrugs[1]._id, drugName: createdDrugs[1].name, dosage: '40mg', frequency: 'Once daily after breakfast', duration: '30 days', quantity: 30 },
        { drugId: createdDrugs[2]._id, drugName: createdDrugs[2].name, dosage: '25mg', frequency: 'Once daily morning', duration: '30 days', quantity: 30 },
      ],
      status: 'dispensed' as const,
      dispensedBy: receptionUser._id,
      dispensedAt: todayDate,
      notes: 'Maintain low salt diet. Target systolic BP < 130 mmHg. Review in 30 days.',
      createdAt: todayDate,
    },
    // Today's Orthopedic prescription for Kabir Mehta (linked to his appointment today)
    {
      patientId: patients[4]._id,
      doctorId: docOrthoSenior._id,
      appointmentId: appointmentMap.get('today_ortho_kabir')?._id,
      lineItems: [
        { drugId: createdDrugs[6]._id, drugName: createdDrugs[6].name, dosage: '500mg', frequency: 'Twice daily with meals', duration: '60 days', quantity: 120 },
        { drugId: createdDrugs[8]._id, drugName: createdDrugs[8].name, dosage: '650mg', frequency: 'As needed for acute knee pain (max 2/day)', duration: '15 days', quantity: 15 },
      ],
      status: 'active' as const,
      notes: 'Avoid deep squats. Continue quadriceps isometric strengthening exercises.',
      createdAt: todayDate,
    },
    // Past July Prescription for Rohan Gupta (linked to July 8 appointment)
    {
      patientId: patients[2]._id,
      doctorId: docCardioSenior._id,
      appointmentId: appointmentMap.get('past_july_cardio_rohan')?._id,
      lineItems: [
        { drugId: createdDrugs[0]._id, drugName: createdDrugs[0].name, dosage: '20mg', frequency: 'Once daily at bedtime', duration: '30 days', quantity: 30 },
        { drugId: createdDrugs[2]._id, drugName: createdDrugs[2].name, dosage: '25mg', frequency: 'Once daily morning', duration: '30 days', quantity: 30 },
      ],
      status: 'dispensed' as const,
      dispensedBy: receptionUser._id,
      dispensedAt: new Date('2026-07-08T11:30:00.000Z'),
      notes: 'Post-angioplasty continuation therapy. Target HR 60-70 bpm.',
      createdAt: new Date('2026-07-08T11:30:00.000Z'),
    },
    // Past August Prescription for Kabir Mehta (linked to August 12 appointment)
    {
      patientId: patients[4]._id,
      doctorId: docOrthoSenior._id,
      appointmentId: appointmentMap.get('past_aug_ortho_kabir')?._id,
      lineItems: [
        { drugId: createdDrugs[6]._id, drugName: createdDrugs[6].name, dosage: '500mg', frequency: 'Twice daily with meals', duration: '30 days', quantity: 60 },
        { drugId: createdDrugs[8]._id, drugName: createdDrugs[8].name, dosage: '650mg', frequency: 'SOS for knee stiffness', duration: '10 days', quantity: 10 },
      ],
      status: 'dispensed' as const,
      dispensedBy: receptionUser._id,
      dispensedAt: new Date('2026-08-12T12:00:00.000Z'),
      notes: 'Pre-operative cartilage preservation regimen.',
      createdAt: new Date('2026-08-12T12:00:00.000Z'),
    },
    // Past September Prescription for Arjun Rao (linked to September 9 appointment)
    {
      patientId: patients[6]._id,
      doctorId: docPedsPulmo._id,
      appointmentId: appointmentMap.get('past_sep_pulmo_arjun')?._id,
      lineItems: [
        { drugId: createdDrugs[3]._id, drugName: createdDrugs[3].name, dosage: '228mg/5ml', frequency: '5ml twice daily', duration: '7 days', quantity: 1 },
        { drugId: createdDrugs[7]._id, drugName: createdDrugs[7].name, dosage: '200mcg', frequency: '1 puff twice daily via spacer', duration: '30 days', quantity: 1 },
      ],
      status: 'dispensed' as const,
      dispensedBy: receptionUser._id,
      dispensedAt: new Date('2026-09-09T12:30:00.000Z'),
      notes: 'Rinse mouth after corticosteroid inhalation. Review in 4 weeks.',
      createdAt: new Date('2026-09-09T12:30:00.000Z'),
    },
    // Past September Prescription for Meera Kapoor (linked to September 16 appointment)
    {
      patientId: patients[5]._id,
      doctorId: docMedDiab._id,
      appointmentId: appointmentMap.get('past_sep_diab_meera')?._id,
      lineItems: [
        { drugId: createdDrugs[5]._id, drugName: createdDrugs[5].name, dosage: '500mg', frequency: 'Once daily after dinner', duration: '60 days', quantity: 60 },
        { drugId: createdDrugs[9]._id, drugName: createdDrugs[9].name, dosage: '75mcg', frequency: 'Once daily morning empty stomach', duration: '60 days', quantity: 60 },
      ],
      status: 'dispensed' as const,
      dispensedBy: receptionUser._id,
      dispensedAt: new Date('2026-09-16T12:00:00.000Z'),
      notes: 'Take Levothyroxine with plain water at least 30 minutes before breakfast.',
      createdAt: new Date('2026-09-16T12:00:00.000Z'),
    },
  ];

  for (const rxData of prescriptionsData) {
    const existing = await Prescription.findOne({
      patientId: rxData.patientId,
      doctorId: rxData.doctorId,
      status: rxData.status,
      dispensedAt: rxData.dispensedAt,
    });
    if (!existing) {
      const rx = new Prescription(rxData);
      await rx.save();
      const rxCreatedAt = rxData.createdAt || rxData.dispensedAt || new Date();
      await Prescription.updateOne(
        { _id: rx._id },
        { $set: { createdAt: rxCreatedAt, updatedAt: rxCreatedAt } }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 9. ITEMIZED BILLING & TAX INVOICES (Properly Linked to Clinical Appointments)
  // ---------------------------------------------------------------------------
  const invoiceDefinitions = [
    // 1. PAID INVOICE - Full Payment with Card & Itemized Tax (Rohan Gupta, linked to cardiology appointment)
    {
      patient: patients[2]._id,
      appointment: appointmentMap.get('today_cardio_rohan')?._id,
      lineItems: [
        { description: 'Comprehensive Interventional Cardiology Consultation', quantity: 1, unitPrice: 1200, category: 'consultation' as const },
        { description: '12-Lead Electrocardiogram (ECG) with Physician Interpretation', quantity: 1, unitPrice: 450, category: 'procedure' as const },
        { description: '2D Echocardiogram with Color Doppler Mapping', quantity: 1, unitPrice: 2200, category: 'procedure' as const },
        { description: 'Atorvastatin 20mg Tablets (30 Days Dispensation)', quantity: 1, unitPrice: 280, category: 'medicine' as const },
        { description: 'Hospital Bio-Waste & Consumables Disposal Surcharge', quantity: 1, unitPrice: 150, category: 'other' as const },
      ],
      taxRate: 5,
      discount: 280, // Privilege Discount
      status: 'paid' as const,
      issuedDate: new Date(Date.now() - 3 * 86400000),
      dueDate: new Date(Date.now() + 10 * 86400000),
      paidDate: new Date(Date.now() - 2 * 86400000),
      payments: [
        {
          amount: 4200,
          method: 'card' as const,
          paidAt: new Date(Date.now() - 2 * 86400000),
          reference: 'POS-HDFC-994108',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Fully settled at reception counter. PDF tax receipt dispatched.',
    },

    // 2. PARTIALLY PAID INVOICE - Demonstrating Active Outstanding Balance (Kabir Mehta, linked to ortho appointment)
    {
      patient: patients[4]._id,
      appointment: appointmentMap.get('today_ortho_kabir')?._id,
      lineItems: [
        { description: 'Senior Orthopedic Joint Replacement Consultation', quantity: 1, unitPrice: 1100, category: 'consultation' as const },
        { description: 'Bilateral Knee Joint Fluoroscopic Aspiration & Decompression', quantity: 1, unitPrice: 3500, category: 'procedure' as const },
        { description: 'Intra-articular Viscosupplementation Gel Pre-filled Syringes', quantity: 2, unitPrice: 2100, category: 'medicine' as const },
        { description: 'Rigid Hinged Knee Orthotic Support Brace', quantity: 1, unitPrice: 1500, category: 'other' as const },
      ],
      taxRate: 12,
      discount: 500, // Ortho Clinic Discount
      status: 'partial' as const,
      issuedDate: new Date(Date.now() - 5 * 86400000),
      dueDate: new Date(Date.now() + 9 * 86400000),
      payments: [
        {
          amount: 5000,
          method: 'transfer' as const,
          paidAt: new Date(Date.now() - 4 * 86400000),
          reference: 'NEFT-SBI-499120',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Initial advance paid. Remaining balance scheduled for clearance next week.',
    },

    // 3. ISSUED INVOICE - Clean Billed Invoice Awaiting Settlement (Diya Patel, linked to adult cardiology screening)
    {
      patient: patients[1]._id,
      appointment: appointmentMap.get('today_cardio_diya')?._id,
      lineItems: [
        { description: 'Comprehensive Hypertension & Cardiology Consultation', quantity: 1, unitPrice: 1200, category: 'consultation' as const },
        { description: 'Resting Electrocardiogram (ECG) Recording', quantity: 1, unitPrice: 450, category: 'procedure' as const },
        { description: 'Serum Electrolyte & Renal Profile Screen', quantity: 1, unitPrice: 850, category: 'procedure' as const },
      ],
      taxRate: 5,
      discount: 0,
      status: 'issued' as const,
      issuedDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      notes: 'Issued at discharge desk. Please remit payment within 14 business days.',
    },

    // 4. DRAFT INVOICE - Clinical In-Progress Draft Bill (Aarav Sharma, linked to medicine consultation)
    {
      patient: patients[0]._id,
      appointment: appointmentMap.get('today_med_aarav')?._id,
      lineItems: [
        { description: 'Internal Medicine Specialist Consultation', quantity: 1, unitPrice: 600, category: 'consultation' as const },
        { description: 'Continuous Ambulatory Blood Pressure Monitoring (4 Hours)', quantity: 1, unitPrice: 800, category: 'procedure' as const },
        { description: 'Telmisartan 40mg Starter Pack (30 Tablets)', quantity: 1, unitPrice: 220, category: 'medicine' as const },
      ],
      taxRate: 5,
      discount: 100,
      status: 'draft' as const,
      notes: 'Pending final review before formal invoice issuance.',
    },

    // 5. OVERDUE INVOICE - Edge Case: Due Date Elapsed in Past (Sunita Verma)
    {
      patient: patients[7]._id,
      appointment: appointmentMap.get('past_sep_med_sunita')?._id,
      lineItems: [
        { description: 'Geriatric Comprehensive Multi-Organ Consultation', quantity: 1, unitPrice: 950, category: 'consultation' as const },
        { description: 'Dual-Energy X-ray Absorptiometry (DEXA Bone Scan)', quantity: 1, unitPrice: 2400, category: 'procedure' as const },
      ],
      taxRate: 5,
      discount: 0,
      status: 'overdue' as const,
      issuedDate: new Date(Date.now() - 40 * 86400000),
      dueDate: new Date(Date.now() - 10 * 86400000), // Due date in the past!
      notes: 'Payment overdue. Second reminder dispatched via automated SMS.',
    },

    // 6. VOID INVOICE - Edge Case: Cancelled Invoice with Audit Trail (Karan Singhania)
    {
      patient: patients[8]._id,
      lineItems: [
        { description: 'General Medicine Duplicate Assessment Fee', quantity: 1, unitPrice: 600, category: 'consultation' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'void' as const,
      issuedDate: new Date(Date.now() - 12 * 86400000),
      voidedBy: adminUser._id,
      voidReason: 'Billed in error under duplicate booking - charges transferred to main patient file',
      notes: 'Voided by administrative supervisor.',
    },

    // 7. HIGH-VALUE SURGICAL WITH INSURANCE SETTLEMENT (Rohan Gupta)
    {
      patient: patients[2]._id,
      appointment: appointmentMap.get('past_yesterday_cardio_rohan')?._id,
      lineItems: [
        { description: 'Coronary Angiography Diagnostic Study in Cath Lab', quantity: 1, unitPrice: 15000, category: 'procedure' as const },
        { description: 'Cardiac Daycare Observation Suite & Telemetry Bed', quantity: 1, unitPrice: 3500, category: 'other' as const },
        { description: 'Non-Ionic Contrast Media Infusion (Omnipaque 350)', quantity: 1, unitPrice: 1800, category: 'medicine' as const },
        { description: 'Post-Angio Hemostatic Compression Bandage Kit', quantity: 1, unitPrice: 1200, category: 'other' as const },
      ],
      taxRate: 5,
      discount: 1000,
      status: 'paid' as const,
      insurance: {
        provider: 'Star Health Premier Heart Care',
        policyNumber: 'SH-POL-883910',
        coverageAmount: 18000,
      },
      issuedDate: new Date(Date.now() - 14 * 86400000),
      dueDate: new Date(Date.now() + 7 * 86400000),
      paidDate: new Date(Date.now() - 12 * 86400000),
      payments: [
        {
          amount: 18000,
          method: 'insurance' as const,
          paidAt: new Date(Date.now() - 13 * 86400000),
          reference: 'INS-CLM-8849201',
          recordedBy: receptionUser._id,
        },
        {
          amount: 3575,
          method: 'card' as const,
          paidAt: new Date(Date.now() - 12 * 86400000),
          reference: 'POS-ICICI-00192',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Complete cashless insurance claim processed plus patient co-pay.',
    },

    // === HISTORICAL MULTI-MONTH INVOICES (JULY, AUGUST, SEPTEMBER, OCTOBER 2026) ===
    // --- JULY 2026 INVOICES ---
    {
      patient: patients[2]._id,
      appointment: appointmentMap.get('past_july_cardio_rohan')?._id,
      lineItems: [
        { description: 'Angioplasty Cath Lab Suite & Diagnostic Fluoroscopy', quantity: 1, unitPrice: 85000, category: 'procedure' as const },
        { description: 'Drug-Eluting Stent (Everolimus-Eluting Cobalt Chromium)', quantity: 1, unitPrice: 30000, category: 'medicine' as const },
        { description: 'Cardiac ICU Telemetry & Specialist Care (2 Days)', quantity: 2, unitPrice: 5000, category: 'other' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-07-09T10:00:00.000Z'),
      paidDate: new Date('2026-07-09T11:00:00.000Z'),
      payments: [
        {
          amount: 100000,
          method: 'insurance' as const,
          paidAt: new Date('2026-07-09T10:30:00.000Z'),
          reference: 'INS-CLM-771920',
          recordedBy: receptionUser._id,
        },
        {
          amount: 25000,
          method: 'transfer' as const,
          paidAt: new Date('2026-07-09T11:00:00.000Z'),
          reference: 'IMPS-HDFC-984128',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Settled via cashless insurance claim and patient IMPS transfer.',
    },
    {
      patient: patients[4]._id,
      appointment: appointmentMap.get('past_july_ortho_kabir')?._id,
      lineItems: [
        { description: 'Diagnostic Knee Arthroscopy & Synovial Biopsy', quantity: 1, unitPrice: 35000, category: 'procedure' as const },
        { description: 'Specialized Arthroscopic Disposable Kit', quantity: 1, unitPrice: 8000, category: 'other' as const },
        { description: 'General Anesthesia & Monitoring', quantity: 1, unitPrice: 5000, category: 'procedure' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-07-16T12:00:00.000Z'),
      paidDate: new Date('2026-07-16T12:30:00.000Z'),
      payments: [
        {
          amount: 48000,
          method: 'card' as const,
          paidAt: new Date('2026-07-16T12:30:00.000Z'),
          reference: 'POS-HDFC-77102',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Paid in full at counter via HDFC credit card.',
    },
    {
      patient: patients[6]._id,
      appointment: appointmentMap.get('past_july_peds_arjun')?._id,
      lineItems: [
        { description: 'Pediatric Development & Allergy Evaluation', quantity: 1, unitPrice: 800, category: 'consultation' as const },
        { description: 'Pediatric DTaP / IPV / Hib Vaccine Pack', quantity: 1, unitPrice: 4500, category: 'medicine' as const },
        { description: 'Pediatric Growth & Wellness Report', quantity: 1, unitPrice: 1200, category: 'other' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-07-23T15:00:00.000Z'),
      paidDate: new Date('2026-07-23T15:15:00.000Z'),
      payments: [
        {
          amount: 6500,
          method: 'cash' as const,
          paidAt: new Date('2026-07-23T15:15:00.000Z'),
          reference: 'CASH-REC-7019',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Paid in cash at outpatient counter.',
    },
    {
      patient: patients[7]._id,
      appointment: appointmentMap.get('past_july_med_sunita')?._id,
      lineItems: [
        { description: 'Geriatric Multi-Organ Consultation', quantity: 1, unitPrice: 950, category: 'consultation' as const },
        { description: 'DEXA Bone Mineral Density Scan', quantity: 1, unitPrice: 2400, category: 'procedure' as const },
        { description: 'Renal Function & Electrolyte Panel', quantity: 1, unitPrice: 850, category: 'procedure' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-07-30T11:00:00.000Z'),
      paidDate: new Date('2026-07-30T11:20:00.000Z'),
      payments: [
        {
          amount: 4200,
          method: 'cash' as const,
          paidAt: new Date('2026-07-30T11:20:00.000Z'),
          reference: 'CASH-REC-70231',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Paid in cash at billing desk.',
    },

    // --- AUGUST 2026 INVOICES ---
    {
      patient: patients[3]._id,
      appointment: appointmentMap.get('past_aug_neuro_ananya')?._id,
      lineItems: [
        { description: 'Senior Neurologist Comprehensive Consultation', quantity: 1, unitPrice: 1200, category: 'consultation' as const },
        { description: 'Brain MRI with Contrast & Neuro-Angiography', quantity: 1, unitPrice: 18000, category: 'procedure' as const },
        { description: 'Neuro-Critical Care Monitoring Observation', quantity: 1, unitPrice: 8000, category: 'other' as const },
        { description: 'Antioxidant & Neuro-Vascular Infusion', quantity: 1, unitPrice: 2800, category: 'medicine' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-08-06T14:00:00.000Z'),
      paidDate: new Date('2026-08-06T14:45:00.000Z'),
      payments: [
        {
          amount: 22000,
          method: 'insurance' as const,
          paidAt: new Date('2026-08-06T14:30:00.000Z'),
          reference: 'INS-CLM-819203',
          recordedBy: receptionUser._id,
        },
        {
          amount: 8000,
          method: 'transfer' as const,
          paidAt: new Date('2026-08-06T14:45:00.000Z'),
          reference: 'IMPS-HDFC-88129',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Cleared through Care Health insurance and direct online transfer.',
    },
    {
      patient: patients[2]._id,
      appointment: appointmentMap.get('past_aug_cardio_rohan')?._id,
      lineItems: [
        { description: 'Interventional Cardiology Consultation', quantity: 1, unitPrice: 1200, category: 'consultation' as const },
        { description: 'Treadmill Stress Test & Dobutamine Stress Echo', quantity: 1, unitPrice: 6500, category: 'procedure' as const },
        { description: 'Cardiovascular Risk Stratification Report', quantity: 1, unitPrice: 1500, category: 'other' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-08-13T10:00:00.000Z'),
      paidDate: new Date('2026-08-13T10:20:00.000Z'),
      payments: [
        {
          amount: 9200,
          method: 'card' as const,
          paidAt: new Date('2026-08-13T10:20:00.000Z'),
          reference: 'POS-SBI-00192',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Settled by card payment.',
    },
    {
      patient: patients[4]._id,
      appointment: appointmentMap.get('past_aug_ortho_kabir')?._id,
      lineItems: [
        { description: 'Orthopedic Joint Replacement Surgeon Evaluation', quantity: 1, unitPrice: 1100, category: 'consultation' as const },
        { description: 'Fluoroscopy-Guided Knee Aspiration & Hyaluronic Acid Injection', quantity: 1, unitPrice: 8500, category: 'procedure' as const },
        { description: 'High-Molecular Weight Synovial Fluid Prosthesis', quantity: 1, unitPrice: 12000, category: 'medicine' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-08-20T11:00:00.000Z'),
      paidDate: new Date('2026-08-20T11:30:00.000Z'),
      payments: [
        {
          amount: 21600,
          method: 'transfer' as const,
          paidAt: new Date('2026-08-20T11:30:00.000Z'),
          reference: 'NEFT-AXIS-99201',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Cleared via NEFT bank transfer.',
    },
    {
      patient: patients[9]._id,
      appointment: appointmentMap.get('past_aug_derm_fatima')?._id,
      lineItems: [
        { description: 'Dermatology Consultation & Surgical Assessment', quantity: 1, unitPrice: 700, category: 'consultation' as const },
        { description: 'Minor Day-Care Dermatosurgery / Excision Biopsy', quantity: 1, unitPrice: 4500, category: 'procedure' as const },
        { description: 'Histopathology Tissue Processing & Staining', quantity: 1, unitPrice: 1800, category: 'other' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-08-27T16:00:00.000Z'),
      paidDate: new Date('2026-08-27T16:15:00.000Z'),
      payments: [
        {
          amount: 7000,
          method: 'cash' as const,
          paidAt: new Date('2026-08-27T16:15:00.000Z'),
          reference: 'CASH-REC-8821',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Paid in cash at day-care surgery desk.',
    },

    // --- SEPTEMBER 2026 INVOICES ---
    {
      patient: patients[4]._id,
      appointment: appointmentMap.get('past_sep_ortho_kabir')?._id,
      lineItems: [
        { description: 'Robotic-Assisted Total Knee Arthroplasty (Surgery Package)', quantity: 1, unitPrice: 180000, category: 'procedure' as const },
        { description: 'High-Flex Cruciate Retaining Knee Implant System', quantity: 1, unitPrice: 65000, category: 'medicine' as const },
        { description: 'Orthopedic Inpatient Surgical Room (3 Days)', quantity: 3, unitPrice: 6000, category: 'other' as const },
        { description: 'Post-Op Continuous Passive Motion (CPM) & Physiotherapy', quantity: 1, unitPrice: 4500, category: 'procedure' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-09-04T12:00:00.000Z'),
      paidDate: new Date('2026-09-04T14:00:00.000Z'),
      payments: [
        {
          amount: 220000,
          method: 'insurance' as const,
          paidAt: new Date('2026-09-04T13:30:00.000Z'),
          reference: 'INS-CLM-902182',
          recordedBy: receptionUser._id,
        },
        {
          amount: 47500,
          method: 'transfer' as const,
          paidAt: new Date('2026-09-04T14:00:00.000Z'),
          reference: 'RTGS-HDFC-00129',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Major surgical claim settled via Niva Bupa insurance + RTGS patient co-pay.',
    },
    {
      patient: patients[2]._id,
      appointment: appointmentMap.get('past_sep_cardio_rohan')?._id,
      lineItems: [
        { description: 'Interventional Cardiology Comprehensive Follow-up', quantity: 1, unitPrice: 1200, category: 'consultation' as const },
        { description: 'High-Resolution 2D Echocardiogram with Strain Imaging', quantity: 1, unitPrice: 3800, category: 'procedure' as const },
        { description: 'Extended Lipid Sub-Fraction & Apolipoprotein Panel', quantity: 1, unitPrice: 2200, category: 'procedure' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-09-11T11:00:00.000Z'),
      paidDate: new Date('2026-09-11T11:20:00.000Z'),
      payments: [
        {
          amount: 7200,
          method: 'card' as const,
          paidAt: new Date('2026-09-11T11:20:00.000Z'),
          reference: 'POS-KOTAK-7719',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Cleared by card at reception.',
    },
    {
      patient: patients[6]._id,
      appointment: appointmentMap.get('past_sep_pulmo_arjun')?._id,
      lineItems: [
        { description: 'Pediatric Pulmonology Specialist Consultation', quantity: 1, unitPrice: 750, category: 'consultation' as const },
        { description: 'Pediatric Computerized Spirometry & Flow-Volume Loop', quantity: 1, unitPrice: 2200, category: 'procedure' as const },
        { description: 'AeroChamber Plus Pediatric Spacer Device with Mask', quantity: 1, unitPrice: 1400, category: 'medicine' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-09-18T10:00:00.000Z'),
      paidDate: new Date('2026-09-18T10:15:00.000Z'),
      payments: [
        {
          amount: 4350,
          method: 'cash' as const,
          paidAt: new Date('2026-09-18T10:15:00.000Z'),
          reference: 'CASH-REC-9012',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Paid in cash at pediatric clinic counter.',
    },
    {
      patient: patients[8]._id,
      appointment: appointmentMap.get('past_sep_sports_karan')?._id,
      lineItems: [
        { description: 'Sports Medicine & Spinal Rehabilitation Consultation', quantity: 1, unitPrice: 950, category: 'consultation' as const },
        { description: 'Dynamic Digital Lumbar Spine Radiographs (Flex/Ext)', quantity: 1, unitPrice: 1800, category: 'procedure' as const },
        { description: 'Targeted Lumbar Core Stabilization Protocol Plan', quantity: 1, unitPrice: 2500, category: 'procedure' as const },
      ],
      taxRate: 0,
      discount: 0,
      status: 'paid' as const,
      issuedDate: new Date('2026-09-25T15:00:00.000Z'),
      paidDate: new Date('2026-09-25T15:30:00.000Z'),
      payments: [
        {
          amount: 5250,
          method: 'transfer' as const,
          paidAt: new Date('2026-09-25T15:30:00.000Z'),
          reference: 'UPI-ICICI-881923',
          recordedBy: receptionUser._id,
        },
      ],
      notes: 'Paid via instant UPI QR at counter.',
    },
  ];

  for (const invData of invoiceDefinitions) {
    const existing = await Invoice.findOne({
      patient: invData.patient,
      status: invData.status,
      issuedDate: invData.issuedDate,
    });
    if (!existing) {
      const inv = new Invoice({
        ...invData,
        issuedBy: (invData as any).issuedBy || receptionUser._id,
      });
      await inv.save();
      const invoiceCreatedAt = invData.issuedDate || new Date();
      await Invoice.updateOne(
        { _id: inv._id },
        { $set: { createdAt: invoiceCreatedAt, updatedAt: invoiceCreatedAt } }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 10. LAB ORDERS & DIAGNOSTIC RESULTS (Multi-Month Historical & Current)
  // ---------------------------------------------------------------------------
  const labOrdersData = [
    // --- JULY 2026 LAB ORDERS ---
    {
      patient: patients[2]._id, // Rohan Gupta
      doctor: docCardioSenior._id,
      priority: 'urgent' as const,
      status: 'completed' as const,
      notes: 'Pre-procedure cardiac baseline biomarkers prior to coronary angiography',
      orderedAt: new Date('2026-07-07T09:00:00.000Z'),
      resultedAt: new Date('2026-07-07T14:30:00.000Z'),
      tests: [
        { name: 'High-Sensitivity Troponin-I (hs-cTnI)', code: 'LAB-TROP-I', status: 'completed' as const },
        { name: 'Creatine Kinase-MB (CK-MB Mass)', code: 'LAB-CKMB', status: 'completed' as const },
        { name: 'Lipid Profile Comprehensive Panel', code: 'LAB-LIPID', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-TROP-I', testName: 'High-Sensitivity Troponin-I', value: '0.045', unit: 'ng/mL', referenceRange: '< 0.040', isNormal: false },
        { testCode: 'LAB-CKMB', testName: 'CK-MB Mass', value: '7.8', unit: 'ng/mL', referenceRange: '0.6 - 6.3', isNormal: false },
        { testCode: 'LAB-CHOL', testName: 'Total Serum Cholesterol', value: '232', unit: 'mg/dL', referenceRange: '< 200', isNormal: false },
        { testCode: 'LAB-LDL', testName: 'Low-Density Lipoprotein (LDL)', value: '142', unit: 'mg/dL', referenceRange: '< 100', isNormal: false },
        { testCode: 'LAB-HDL', testName: 'High-Density Lipoprotein (HDL)', value: '38', unit: 'mg/dL', referenceRange: '> 40', isNormal: false },
      ],
    },
    {
      patient: patients[3]._id, // Ananya Deshmukh
      doctor: docNeuroSenior._id,
      priority: 'routine' as const,
      status: 'completed' as const,
      notes: 'Evaluate recurrent unilateral cefalea and visual scotoma',
      orderedAt: new Date('2026-07-21T10:15:00.000Z'),
      resultedAt: new Date('2026-07-22T11:00:00.000Z'),
      tests: [
        { name: 'Electroencephalogram (EEG) Computerized Study', code: 'LAB-EEG-01', status: 'completed' as const },
        { name: 'Serum Electrolytes & Magnesium Panel', code: 'LAB-ELECT-MG', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-EEG-01', testName: 'EEG Waveform Study', value: 'Normal Alpha Rhythm', unit: 'Pattern', referenceRange: 'Symmetric Alpha', isNormal: true },
        { testCode: 'LAB-MG', testName: 'Serum Magnesium', value: '2.05', unit: 'mg/dL', referenceRange: '1.7 - 2.4', isNormal: true },
        { testCode: 'LAB-NA', testName: 'Serum Sodium', value: '139', unit: 'mEq/L', referenceRange: '135 - 145', isNormal: true },
        { testCode: 'LAB-K', testName: 'Serum Potassium', value: '4.1', unit: 'mEq/L', referenceRange: '3.5 - 5.0', isNormal: true },
      ],
    },

    // --- AUGUST 2026 LAB ORDERS ---
    {
      patient: patients[7]._id, // Sunita Verma
      doctor: docMedSenior._id,
      priority: 'routine' as const,
      status: 'completed' as const,
      notes: 'Mid-summer diabetic nephropathy and renal function tracking',
      orderedAt: new Date('2026-08-11T08:30:00.000Z'),
      resultedAt: new Date('2026-08-11T16:00:00.000Z'),
      tests: [
        { name: 'Serum Creatinine & eGFR Calculation', code: 'LAB-CREAT', status: 'completed' as const },
        { name: 'Blood Urea Nitrogen (BUN)', code: 'LAB-BUN', status: 'completed' as const },
        { name: 'Serum Potassium', code: 'LAB-K', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-CREAT', testName: 'Serum Creatinine', value: '1.48', unit: 'mg/dL', referenceRange: '0.50 - 1.10', isNormal: false },
        { testCode: 'LAB-EGFR', testName: 'Estimated Glomerular Filtration Rate (eGFR)', value: '49', unit: 'mL/min/1.73m²', referenceRange: '> 60', isNormal: false },
        { testCode: 'LAB-BUN', testName: 'Blood Urea Nitrogen (BUN)', value: '28', unit: 'mg/dL', referenceRange: '7 - 20', isNormal: false },
        { testCode: 'LAB-K', testName: 'Serum Potassium', value: '4.7', unit: 'mEq/L', referenceRange: '3.5 - 5.0', isNormal: true },
      ],
    },
    {
      patient: patients[5]._id, // Meera Kapoor
      doctor: docMedDiab._id,
      priority: 'routine' as const,
      status: 'completed' as const,
      notes: 'Metabolic & thyroid endocrine quarterly check',
      orderedAt: new Date('2026-08-18T09:45:00.000Z'),
      resultedAt: new Date('2026-08-19T10:30:00.000Z'),
      tests: [
        { name: 'Glycated Hemoglobin (HbA1c)', code: 'LAB-HBA1C', status: 'completed' as const },
        { name: 'Fasting Plasma Glucose (FPG)', code: 'LAB-FPG', status: 'completed' as const },
        { name: 'High-Sensitivity Thyroid Stimulating Hormone (TSH)', code: 'LAB-TSH', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-HBA1C', testName: 'Glycated Hemoglobin (HbA1c)', value: '7.4', unit: '%', referenceRange: '< 5.7', isNormal: false },
        { testCode: 'LAB-FPG', testName: 'Fasting Plasma Glucose', value: '138', unit: 'mg/dL', referenceRange: '70 - 99', isNormal: false },
        { testCode: 'LAB-TSH', testName: 'Thyroid Stimulating Hormone (TSH)', value: '4.2', unit: 'uIU/mL', referenceRange: '0.4 - 4.0', isNormal: false },
      ],
    },

    // --- SEPTEMBER 2026 LAB ORDERS ---
    {
      patient: patients[4]._id, // Kabir Mehta
      doctor: docOrthoSenior._id,
      priority: 'urgent' as const,
      status: 'completed' as const,
      notes: 'Pre-operative workup and clearance for Total Knee Replacement',
      orderedAt: new Date('2026-09-08T11:00:00.000Z'),
      resultedAt: new Date('2026-09-08T17:30:00.000Z'),
      tests: [
        { name: 'Prothrombin Time & INR (Coagulation)', code: 'LAB-PT-INR', status: 'completed' as const },
        { name: 'High-Sensitivity C-Reactive Protein (hs-CRP)', code: 'LAB-HS-CRP', status: 'completed' as const },
        { name: 'Complete Blood Count (CBC with Automated Diff)', code: 'LAB-CBC', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-INR', testName: 'International Normalized Ratio (INR)', value: '1.02', unit: 'ratio', referenceRange: '0.8 - 1.2', isNormal: true },
        { testCode: 'LAB-HS-CRP', testName: 'C-Reactive Protein (CRP)', value: '3.6', unit: 'mg/L', referenceRange: '< 3.0', isNormal: false },
        { testCode: 'LAB-HB', testName: 'Hemoglobin', value: '14.1', unit: 'g/dL', referenceRange: '13.0 - 17.0', isNormal: true },
        { testCode: 'LAB-PLT', testName: 'Platelet Count', value: '254', unit: '10^3/uL', referenceRange: '150 - 450', isNormal: true },
      ],
    },
    {
      patient: patients[6]._id, // Arjun Rao (Pediatric)
      doctor: docPedsSenior._id,
      priority: 'routine' as const,
      status: 'completed' as const,
      notes: 'Pediatric atopic dermatitis and allergic sensitization evaluation',
      orderedAt: new Date('2026-09-22T10:00:00.000Z'),
      resultedAt: new Date('2026-09-23T09:30:00.000Z'),
      tests: [
        { name: 'Total Serum Immunoglobulin E (IgE)', code: 'LAB-IGE', status: 'completed' as const },
        { name: 'Absolute Eosinophil Count (AEC)', code: 'LAB-AEC', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-IGE', testName: 'Total Serum IgE', value: '248', unit: 'IU/mL', referenceRange: '< 90', isNormal: false },
        { testCode: 'LAB-AEC', testName: 'Absolute Eosinophil Count', value: '520', unit: '/mcL', referenceRange: '40 - 450', isNormal: false },
      ],
    },

    // --- OCTOBER 2026 CURRENT LAB ORDERS ---
    {
      patient: patients[2]._id, // Rohan Gupta
      doctor: docCardioSenior._id,
      priority: 'urgent' as const,
      status: 'completed' as const,
      notes: 'Evaluate post-stent cardiac biomarkers and lipid targets',
      orderedAt: new Date(Date.now() - 4 * 86400000),
      resultedAt: new Date(Date.now() - 3 * 86400000),
      tests: [
        { name: 'High-Sensitivity Troponin-I (hs-cTnI)', code: 'LAB-TROP-I', status: 'completed' as const },
        { name: 'Creatine Kinase-MB (CK-MB Mass)', code: 'LAB-CKMB', status: 'completed' as const },
        { name: 'Lipid Profile Comprehensive Panel', code: 'LAB-LIPID', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-TROP-I', testName: 'High-Sensitivity Troponin-I', value: '0.012', unit: 'ng/mL', referenceRange: '< 0.040', isNormal: true },
        { testCode: 'LAB-CKMB', testName: 'CK-MB Mass', value: '2.1', unit: 'ng/mL', referenceRange: '0.6 - 6.3', isNormal: true },
        { testCode: 'LAB-CHOL', testName: 'Total Serum Cholesterol', value: '184', unit: 'mg/dL', referenceRange: '< 200', isNormal: true },
        { testCode: 'LAB-LDL', testName: 'Low-Density Lipoprotein (LDL)', value: '86', unit: 'mg/dL', referenceRange: '< 100', isNormal: true },
        { testCode: 'LAB-HDL', testName: 'High-Density Lipoprotein (HDL)', value: '48', unit: 'mg/dL', referenceRange: '> 40', isNormal: true },
      ],
    },
    {
      patient: patients[7]._id, // Sunita Verma (CKD)
      doctor: docMedSenior._id,
      priority: 'routine' as const,
      status: 'completed' as const,
      notes: 'Monitor renal clearance, eGFR, and electrolytes',
      orderedAt: new Date(Date.now() - 3 * 86400000),
      resultedAt: new Date(Date.now() - 2 * 86400000),
      tests: [
        { name: 'Serum Creatinine & eGFR Calculation', code: 'LAB-CREAT', status: 'completed' as const },
        { name: 'Blood Urea Nitrogen (BUN)', code: 'LAB-BUN', status: 'completed' as const },
      ],
      results: [
        { testCode: 'LAB-CREAT', testName: 'Serum Creatinine', value: '1.42', unit: 'mg/dL', referenceRange: '0.50 - 1.10', isNormal: false },
        { testCode: 'LAB-EGFR', testName: 'Estimated Glomerular Filtration Rate (eGFR)', value: '52', unit: 'mL/min/1.73m²', referenceRange: '> 60', isNormal: false },
        { testCode: 'LAB-BUN', testName: 'Blood Urea Nitrogen (BUN)', value: '26', unit: 'mg/dL', referenceRange: '7 - 20', isNormal: false },
      ],
    },
  ];

  for (const loData of labOrdersData) {
    const existing = await LabOrder.findOne({
      patient: loData.patient,
      doctor: loData.doctor,
      notes: loData.notes,
    });
    if (!existing) {
      const order = new LabOrder({
        patient: loData.patient,
        doctor: loData.doctor,
        priority: loData.priority,
        status: loData.status,
        notes: loData.notes,
        tests: loData.tests,
        orderedAt: loData.orderedAt || new Date(Date.now() - 3 * 86400000),
      });
      await order.save();
      const orderCreatedAt = loData.orderedAt || new Date(Date.now() - 3 * 86400000);
      await LabOrder.updateOne(
        { _id: order._id },
        { $set: { createdAt: orderCreatedAt, updatedAt: orderCreatedAt } }
      );

      if (loData.results && loData.results.length > 0) {
        const resultDate = loData.resultedAt || new Date(Date.now() - 2 * 86400000);
        const labRes = new LabResult({
          labOrder: order._id,
          patient: loData.patient,
          results: loData.results,
          status: 'final',
          technician: adminUser._id,
          verifiedBy: loData.doctor,
          resultedAt: resultDate,
          verifiedAt: resultDate,
        });
        await labRes.save();
        await LabResult.updateOne(
          { _id: labRes._id },
          { $set: { createdAt: resultDate, updatedAt: resultDate } }
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 11. CLINICAL DOCUMENTS (Certificates, Discharge Summaries & Referrals)
  // ---------------------------------------------------------------------------
  const clinicalDocs = [
    // --- JULY 2026 ---
    {
      documentId: 'DOC-2026-0001',
      type: 'discharge_summary' as const,
      patientId: patients[2]._id, // Rohan Gupta
      issuedBy: docCardioSenior._id,
      status: 'issued' as const,
      issuedAt: new Date('2026-07-10T15:00:00.000Z'),
      content: 'Diagnosis: Coronary Artery Disease, Single Vessel Disease (LAD). Procedure: Successful Drug-Eluting Stent (DES) Implantation. Course: Uneventful post-procedure telemetry monitoring. Discharged in hemodynamically stable condition on dual antiplatelet therapy.',
      notes: 'Cath lab day-care interventional cardiology discharge summary.',
    },

    // --- AUGUST 2026 ---
    {
      documentId: 'DOC-2026-0002',
      type: 'medical_certificate' as const,
      patientId: patients[3]._id, // Ananya Deshmukh
      issuedBy: docNeuroSenior._id,
      status: 'issued' as const,
      issuedAt: new Date('2026-08-17T12:00:00.000Z'),
      content: 'Certified that Ms. Ananya Deshmukh is undergoing evaluation for Complex Migraine Cephalea. She is advised 7 days of medical rest with avoidance of visual screen fatigue.',
      notes: 'Workplace medical leave accommodation certificate.',
    },

    // --- SEPTEMBER 2026 ---
    {
      documentId: 'DOC-2026-0003',
      type: 'discharge_summary' as const,
      patientId: patients[4]._id, // Kabir Mehta
      issuedBy: docOrthoSenior._id,
      status: 'issued' as const,
      issuedAt: new Date('2026-09-15T16:30:00.000Z'),
      content: 'Diagnosis: Grade IV Osteoarthritis Left Knee. Procedure: Left Total Knee Arthroplasty (Cruciate Retaining). Course: Independent ambulation achieved with walker on post-op day 3. Wound clean and dry. Transferred to home physiotherapy regimen.',
      notes: 'Inpatient orthopedic surgical discharge summary.',
    },
    {
      documentId: 'DOC-2026-0004',
      type: 'referral' as const,
      patientId: patients[5]._id, // Meera Kapoor
      issuedBy: docMedSenior._id,
      status: 'issued' as const,
      issuedAt: new Date('2026-09-22T11:00:00.000Z'),
      content: 'Referred to Dr. Shalini Pillai (Endocrinology/Diabetology) for optimization of glycemic control and thyroid hormone supplementation dosage.',
      notes: 'Inter-departmental specialist clinical referral.',
    },

    // --- OCTOBER 2026 ---
    {
      documentId: 'DOC-2026-0005',
      type: 'medical_certificate' as const,
      patientId: patients[8]._id, // Karan Singhania
      issuedBy: docOrthoSenior._id,
      status: 'issued' as const,
      issuedAt: new Date(Date.now() - 5 * 86400000),
      content: 'Certified that Mr. Karan Singhania is undergoing active orthopedic rehabilitation for L4-L5 lumbar disc strain. He is advised strict bed rest and ergonomic desk posture adjustments.',
      notes: 'Medical fitness certificate for workplace leave accommodation.',
    },
    {
      documentId: 'DOC-2026-0006',
      type: 'referral' as const,
      patientId: patients[1]._id, // Diya Patel
      issuedBy: docMedSenior._id,
      status: 'issued' as const,
      issuedAt: new Date(Date.now() - 1 * 86400000),
      content: 'Referred to Dr. Priya Nair (Dermatology) for specialized patch testing and assessment of chronic urticaria with suspected peanut and sulfa hypersensitivity.',
      notes: 'Specialist allergy consultation referral.',
    },
  ];

  for (const docItem of clinicalDocs) {
    const existing = await ClinicalDoc.findOne({ documentId: docItem.documentId });
    if (!existing) {
      const d = new ClinicalDoc(docItem);
      await d.save();
      const docCreatedAt = docItem.issuedAt || new Date();
      await ClinicalDoc.updateOne(
        { _id: d._id },
        { $set: { createdAt: docCreatedAt, updatedAt: docCreatedAt } }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 12. ROLE-BASED SYSTEM NOTIFICATIONS (Multi-Month Historical & Current)
  // ---------------------------------------------------------------------------
  const systemNotifications = [
    // --- JULY 2026 ---
    {
      user: adminUser._id,
      title: 'July Financial & Operational Audit Complete',
      message: 'July financial audit closed with 100% register reconciliation across pharmacy, pathology, and inpatient billing.',
      type: 'billing' as const,
      read: true,
      createdAt: new Date('2026-07-31T18:00:00.000Z'),
    },
    {
      user: doc1User._id, // Dr. Arvind Sharma
      title: 'Cath Lab ISO Safety Certification Renewed',
      message: 'Cardiac Interventional Suite completed annual radiation and hygiene inspection with zero non-compliances.',
      type: 'system' as const,
      read: true,
      createdAt: new Date('2026-07-15T14:30:00.000Z'),
    },

    // --- AUGUST 2026 ---
    {
      user: adminUser._id,
      title: 'NABH Hospital Quality Accreditation Review',
      message: 'Quarterly NABH assessment prep cycle initiated. All clinical HODs please ensure documentation compliance.',
      type: 'system' as const,
      read: true,
      createdAt: new Date('2026-08-10T10:00:00.000Z'),
    },
    {
      user: receptionUser._id,
      title: 'Monsoon OPD Surge Protocol Activated',
      message: 'Emergency and pediatric triage desks staffed with additional nursing support for seasonal flu volume.',
      type: 'appointment' as const,
      read: true,
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
    },

    // --- SEPTEMBER 2026 ---
    {
      user: adminUser._id,
      title: 'Pharmacy Bulk Stock Replenishment GRN-2026-09',
      message: 'Consignment GRN-2026-09 cleared: 1,500 units of emergency IV fluids and broad-spectrum antibiotics verified into central stock.',
      type: 'inventory' as const,
      read: true,
      createdAt: new Date('2026-09-05T15:00:00.000Z'),
    },
    {
      user: doc1User._id,
      title: 'Cath Lab Monthly Milestone',
      message: 'Cardiac Catheterization Suite successfully completed 42 interventional procedures in September with 0% adverse events.',
      type: 'appointment' as const,
      read: true,
      createdAt: new Date('2026-09-30T17:00:00.000Z'),
    },

    // --- OCTOBER 2026 CURRENT ---
    {
      user: adminUser._id,
      title: 'Low Pharmacy Stock Alert',
      message: 'Amoxicillin-Clavulanate 625mg has fallen to 18 units (Threshold: 50). Immediate vendor replenishment recommended.',
      type: 'inventory' as const,
      read: false,
      createdAt: new Date(),
    },
    {
      user: adminUser._id,
      title: 'PPE Stock Depleted',
      message: 'N95 Particulate Respirator Masks has 12 boxes remaining (Reorder Level: 30). Central stores PO triggered.',
      type: 'inventory' as const,
      read: false,
      createdAt: new Date(),
    },
    {
      user: doc1User._id, // Dr. Arvind Sharma
      title: 'New Patient Scheduled',
      message: 'Aarav Sharma has booked an interventional consultation for chest tightness evaluation.',
      type: 'appointment' as const,
      read: false,
      createdAt: new Date(),
    },
    {
      user: doc3User._id, // Dr. Rajesh Patel
      title: 'Pre-Op Procedure Completed',
      message: 'Bilateral knee joint aspiration for Kabir Mehta marked as completed with clear aspirate.',
      type: 'appointment' as const,
      read: true,
      createdAt: new Date(Date.now() - 3600000),
    },
    {
      user: receptionUser._id,
      title: 'Outstanding Invoice Follow-up',
      message: 'Invoice for Sunita Verma is now overdue by 10 days. Please verify payment status.',
      type: 'billing' as const,
      read: false,
      createdAt: new Date(),
    },
  ];

  for (const notif of systemNotifications) {
    const existing = await Notification.findOne({
      user: notif.user,
      title: notif.title,
      createdAt: notif.createdAt,
    });
    if (!existing) {
      const n = new Notification(notif);
      await n.save();
      if (notif.createdAt) {
        await Notification.updateOne(
          { _id: n._id },
          { $set: { createdAt: notif.createdAt, updatedAt: notif.createdAt } }
        );
      }
    }
  }

  console.log('\n========================================================================================');
  console.log('       ✨ PulseCare HMS Multi-Speciality Hospital Seed Data Successfully Generated ✨');
  console.log('========================================================================================');
  console.log(`Default Master Password for ALL Accounts: ${SEED_PASSWORD}`);
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Role          | Email                        | Name                | Department / Specialty');
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Admin         | admin@pulsecare.test         | Rajesh Malhotra     | Hospital Administration');
  console.log('| Receptionist  | reception@pulsecare.test     | Pooja Verma         | Central Reception & Billing');
  console.log('| Senior Cardio | dr.sharma@pulsecare.test     | Dr. Arvind Sharma   | Cardiology (Interventional)');
  console.log('| Junior Cardio | dr.viyer@pulsecare.test      | Dr. Vikram Iyer     | Cardiology (Electrophysiology)');
  console.log('| Chief Peds    | dr.kulkarni@pulsecare.test   | Dr. Sneha Kulkarni  | Pediatrics (Neonatology)');
  console.log('| Peds Pulmo    | dr.amukherjee@pulsecare.test | Dr. Ananya Mukherjee| Pediatrics (Pulmonology)');
  console.log('| Senior Ortho  | dr.patel@pulsecare.test      | Dr. Rajesh Patel    | Orthopedics (Joint Replacement)');
  console.log('| Sports Ortho  | dr.deshmukh@pulsecare.test   | Dr. Rohan Deshmukh  | Orthopedics (Sports Medicine)');
  console.log('| Neurologist   | dr.menon@pulsecare.test      | Dr. Radhika Menon   | Neurology (Stroke Specialist)');
  console.log('| Senior Phys   | dr.mehta@pulsecare.test      | Dr. Vedant Mehta    | General Medicine (Internal Med)');
  console.log('| Diabetologist | dr.pillai@pulsecare.test     | Dr. Shalini Pillai  | General Medicine (Diabetology)');
  console.log('| Dermatologist | dr.nair@pulsecare.test       | Dr. Priya Nair      | Dermatology (Laser & Dermato)');
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Patient 1     | patient1@pulsecare.test      | Aarav Sharma        | Blood: O+ (Allergy: Penicillin)');
  console.log('| Patient 2     | patient2@pulsecare.test      | Diya Patel          | Blood: A+ (Allergy: Peanuts, Sulfa)');
  console.log('| Patient 3     | patient3@pulsecare.test      | Rohan Gupta         | Blood: B- (CAD Stent, Star Health)');
  console.log('| Patient 4     | patient4@pulsecare.test      | Ananya Deshmukh     | Blood: AB+ (Allergy: Latex)');
  console.log('| Patient 5     | patient5@pulsecare.test      | Kabir Mehta         | Blood: O- (Severe Knee OA, NSAID allergy)');
  console.log('| Patient 6     | patient6@pulsecare.test      | Meera Kapoor        | Blood: B+ (Hypothyroidism)');
  console.log('| Patient 7     | patient7@pulsecare.test      | Master Arjun Rao    | Blood: A- (Pediatric Eczema)');
  console.log('| Patient 8     | patient8@pulsecare.test      | Sunita Verma        | Blood: AB- (Geriatric CKD, Opioid allergy)');
  console.log('| Patient 9     | patient9@pulsecare.test      | Karan Singhania     | Blood: O+ (Lumbar Radiculopathy)');
  console.log('| Patient 10    | patient10@pulsecare.test     | Fatima Khan         | Blood: B+ (PCOS, Ciprofloxacin allergy)');
  console.log('========================================================================================\n');
}

// Direct CLI execution
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
