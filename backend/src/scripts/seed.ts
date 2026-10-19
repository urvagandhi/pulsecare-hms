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
      Counter.deleteMany({}),
    ]);
    console.log('✅ All collections cleared & counters reset.');
  }

  console.log('🌱 Seeding PulseCare Multi-Speciality Hospital enterprise database...');

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

  // ---------------------------------------------------------------------------
  // 1. HOSPITAL CORE STAFF (Admin & Reception)
  // ---------------------------------------------------------------------------
  const adminUser = await ensureUser({
    firstName: 'Rajesh',
    lastName: 'Malhotra',
    email: 'admin@pulsecare.test',
    role: 'admin',
    phone: '+91-98765-0100',
  });

  const receptionUser = await ensureUser({
    firstName: 'Pooja',
    lastName: 'Verma',
    email: 'reception@pulsecare.test',
    role: 'receptionist',
    phone: '+91-98765-0101',
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
      d.leaves = docData.leaves || [];
      if (docData.rating !== undefined) d.rating = docData.rating;
      if (docData.reviewCount !== undefined) d.reviewCount = docData.reviewCount;
      await d.save();
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
    // Emergency Medical Conference Leave (Demonstrates Slot Blackout Engine)
    leaves: [
      {
        startDate: upcomingWed,
        endDate: upcomingFri,
        reason: 'Keynote Speaker at National Cardiology Conclave 2026',
      },
    ],
    rating: 4.9,
    reviewCount: 142,
  });

  const doc1bUser = await ensureUser({
    firstName: 'Vikram',
    lastName: 'Iyer',
    email: 'dr.viyer@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0112',
  });
  const docCardioJunior = await ensureDoctor(doc1bUser, cardioDept, {
    specialization: 'Non-Invasive Cardiology & Electrophysiology',
    qualification: ['MD (Internal Med)', 'DNB (Cardiology)'],
    consultationFee: 900,
    availability: [
      { day: 'monday', startTime: '13:00', endTime: '18:00' },
      { day: 'wednesday', startTime: '13:00', endTime: '18:00' },
      { day: 'friday', startTime: '13:00', endTime: '18:00' },
      { day: 'saturday', startTime: '09:00', endTime: '14:00' },
    ],
    rating: 4.8,
    reviewCount: 96,
  });

  // --- PEDIATRICS (2 Specialists) ---
  const doc2User = await ensureUser({
    firstName: 'Sneha',
    lastName: 'Kulkarni',
    email: 'dr.kulkarni@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0103',
  });
  const docPedsChief = await ensureDoctor(doc2User, pedsDept, {
    specialization: 'Chief Pediatrician & Neonatologist',
    qualification: ['MD (Pediatrics)', 'DNB (Pediatrics)', 'Fellowship Neonatology (AIIMS)'],
    consultationFee: 800,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '16:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '16:00' },
      { day: 'thursday', startTime: '09:00', endTime: '16:00' },
      { day: 'friday', startTime: '09:00', endTime: '16:00' },
      { day: 'saturday', startTime: '09:00', endTime: '13:00' },
    ],
    rating: 4.9,
    reviewCount: 185,
  });

  const doc2bUser = await ensureUser({
    firstName: 'Ananya',
    lastName: 'Mukherjee',
    email: 'dr.amukherjee@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0113',
  });
  const docPedsPulmo = await ensureDoctor(doc2bUser, pedsDept, {
    specialization: 'Pediatric Pulmonology & Allergy',
    qualification: ['MD (Pediatrics)', 'DCH', 'Fellowship Pediatric Allergy'],
    consultationFee: 750,
    availability: [
      { day: 'tuesday', startTime: '11:00', endTime: '17:00' },
      { day: 'wednesday', startTime: '11:00', endTime: '17:00' },
      { day: 'friday', startTime: '11:00', endTime: '17:00' },
      { day: 'saturday', startTime: '13:00', endTime: '17:00' },
    ],
    rating: 4.7,
    reviewCount: 78,
  });

  // --- ORTHOPEDICS (2 Specialists) ---
  const doc3User = await ensureUser({
    firstName: 'Rajesh',
    lastName: 'Patel',
    email: 'dr.patel@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0104',
  });
  const docOrthoSenior = await ensureDoctor(doc3User, orthoDept, {
    specialization: 'Joint Replacement & Spine Surgery',
    qualification: ['MS (Orthopedics)', 'MCh (Ortho)', 'Fellowship Arthroplasty'],
    consultationFee: 1100,
    availability: [
      { day: 'monday', startTime: '08:30', endTime: '14:30' },
      { day: 'wednesday', startTime: '08:30', endTime: '14:30' },
      { day: 'thursday', startTime: '08:30', endTime: '14:30' },
      { day: 'friday', startTime: '08:30', endTime: '14:30' },
      { day: 'saturday', startTime: '09:00', endTime: '13:00' },
    ],
    // Personal Leave blackout demonstration
    leaves: [
      {
        startDate: upcomingTue,
        endDate: upcomingTue,
        reason: 'Scheduled Orthopedic Surgery Conference & Arthroscopy Training',
      },
    ],
    rating: 4.9,
    reviewCount: 210,
  });

  const doc3bUser = await ensureUser({
    firstName: 'Rohan',
    lastName: 'Deshmukh',
    email: 'dr.deshmukh@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0114',
  });
  const docOrthoSports = await ensureDoctor(doc3bUser, orthoDept, {
    specialization: 'Sports Medicine & Arthroscopic Surgery',
    qualification: ['MS (Orthopedics)', 'Fellowship in Arthroscopy & Sports Rehab'],
    consultationFee: 950,
    availability: [
      { day: 'tuesday', startTime: '09:00', endTime: '16:00' },
      { day: 'wednesday', startTime: '14:00', endTime: '19:00' },
      { day: 'thursday', startTime: '09:00', endTime: '16:00' },
      { day: 'saturday', startTime: '13:00', endTime: '18:00' },
    ],
    rating: 4.8,
    reviewCount: 88,
  });

  // --- NEUROLOGY ---
  const doc4User = await ensureUser({
    firstName: 'Radhika',
    lastName: 'Menon',
    email: 'dr.menon@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0106',
  });
  const docNeuro = await ensureDoctor(doc4User, neuroDept, {
    specialization: 'Neurology & Stroke Intervention',
    qualification: ['MD (Internal Med)', 'DM (Neurology)', 'Fellowship Neuro-Intervention'],
    consultationFee: 1300,
    availability: [
      { day: 'monday', startTime: '10:00', endTime: '16:00' },
      { day: 'wednesday', startTime: '10:00', endTime: '16:00' },
      { day: 'friday', startTime: '10:00', endTime: '16:00' },
    ],
    rating: 4.9,
    reviewCount: 115,
  });

  // --- GENERAL MEDICINE (2 Specialists) ---
  const doc5User = await ensureUser({
    firstName: 'Vedant',
    lastName: 'Mehta',
    email: 'dr.mehta@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0105',
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
  });

  const doc5bUser = await ensureUser({
    firstName: 'Shalini',
    lastName: 'Pillai',
    email: 'dr.pillai@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0115',
  });
  const docMedDiabeto = await ensureDoctor(doc5bUser, genMedDept, {
    specialization: 'Diabetology & Metabolic Disorders',
    qualification: ['MD (General Medicine)', 'Post-Doctoral Fellowship Diabetology'],
    consultationFee: 650,
    availability: [
      { day: 'tuesday', startTime: '09:00', endTime: '15:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '15:00' },
      { day: 'thursday', startTime: '09:00', endTime: '15:00' },
      { day: 'friday', startTime: '09:00', endTime: '15:00' },
    ],
    rating: 4.7,
    reviewCount: 64,
  });

  // --- DERMATOLOGY ---
  const doc6User = await ensureUser({
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'dr.nair@pulsecare.test',
    role: 'doctor',
    phone: '+91-98765-0107',
  });
  const docDerm = await ensureDoctor(doc6User, dermDept, {
    specialization: 'Clinical Dermatology & Laser Therapy',
    qualification: ['MD (DVL)', 'DNB (Dermatology)', 'Fellowship Dermatosurgery'],
    consultationFee: 700,
    availability: [
      { day: 'monday', startTime: '10:00', endTime: '17:00' },
      { day: 'tuesday', startTime: '10:00', endTime: '17:00' },
      { day: 'thursday', startTime: '10:00', endTime: '17:00' },
      { day: 'saturday', startTime: '10:00', endTime: '16:00' },
    ],
    rating: 4.9,
    reviewCount: 92,
  });

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
      user: { firstName: 'Aarav', lastName: 'Sharma', email: 'patient1@pulsecare.test', phone: '+91-98765-0201' },
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
      user: { firstName: 'Diya', lastName: 'Patel', email: 'patient2@pulsecare.test', phone: '+91-98765-0203' },
      profile: {
        bloodGroup: 'A+' as const,
        allergies: ['Peanuts', 'Sulfa drugs (Cotrimoxazole)'],
        emergencyContact: { name: 'Ramesh Patel', relationship: 'Father', phone: '+91-98765-0204' },
        medicalHistory: [
          { condition: 'Gestational Diabetes (Past)', diagnosisDate: new Date('2023-06-20'), notes: 'Post-delivery glucose tolerance normal' },
        ],
        insuranceInfo: { provider: 'HDFC ERGO Health Suraksha', policyNumber: 'HE-MED-554109', expiryDate: new Date('2027-11-15') },
      },
    },
    {
      user: { firstName: 'Rohan', lastName: 'Gupta', email: 'patient3@pulsecare.test', phone: '+91-98765-0205' },
      profile: {
        bloodGroup: 'B-' as const,
        allergies: [], // NKDA (No Known Drug Allergies)
        emergencyContact: { name: 'Kavita Gupta', relationship: 'Spouse', phone: '+91-98765-0206' },
        medicalHistory: [
          { condition: 'Coronary Artery Disease (CAD - Post PTCA with DES stent to LAD)', diagnosisDate: new Date('2021-11-04'), treatment: 'Dual Antiplatelet Therapy (DAPT) & Beta-blocker' },
          { condition: 'Type 2 Diabetes Mellitus', diagnosisDate: new Date('2018-09-12'), treatment: 'Metformin 1000mg ER' },
        ],
        insuranceInfo: { provider: 'Max Bupa HeartBeat Platinum', policyNumber: 'MB-CRD-772911', expiryDate: new Date('2027-03-31') },
      },
    },
    {
      user: { firstName: 'Ananya', lastName: 'Deshmukh', email: 'patient4@pulsecare.test', phone: '+91-98765-0207' },
      profile: {
        bloodGroup: 'AB+' as const,
        allergies: ['Latex', 'Radiological Contrast Dye'],
        emergencyContact: { name: 'Aditya Deshmukh', relationship: 'Brother', phone: '+91-98765-0208' },
        medicalHistory: [
          { condition: 'Moderate Persistent Bronchial Asthma', diagnosisDate: new Date('2019-02-18'), treatment: 'Inhaled Budesonide/Formoterol maintenance' },
        ],
        insuranceInfo: { provider: 'Care Health Advantage', policyNumber: 'CH-AST-112093', expiryDate: new Date('2027-05-20') },
      },
    },
    {
      user: { firstName: 'Kabir', lastName: 'Mehta', email: 'patient5@pulsecare.test', phone: '+91-98765-0209' },
      profile: {
        bloodGroup: 'O-' as const,
        allergies: ['Aspirin', 'Ibuprofen', 'Naproxen (Severe NSAID-induced bronchospasm)'],
        emergencyContact: { name: 'Meera Mehta', relationship: 'Spouse', phone: '+91-98765-0210' },
        medicalHistory: [
          { condition: 'Severe Bilateral Knee Osteoarthritis (Grade 3 Kellgren-Lawrence)', diagnosisDate: new Date('2020-07-22'), treatment: 'Physiotherapy & Intra-articular Viscosupplementation' },
        ],
        insuranceInfo: { provider: 'Niva Bupa ReAssure 2.0', policyNumber: 'NB-ORT-339182', expiryDate: new Date('2027-10-12') },
      },
    },
    {
      user: { firstName: 'Meera', lastName: 'Kapoor', email: 'patient6@pulsecare.test', phone: '+91-98765-0211' },
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
      user: { firstName: 'Arjun', lastName: 'Rao', email: 'patient7@pulsecare.test', phone: '+91-98765-0213' },
      profile: {
        bloodGroup: 'A-' as const,
        allergies: ['Cow Milk Protein', 'Soy'],
        emergencyContact: { name: 'Srinivas Rao', relationship: 'Father (Legal Guardian)', phone: '+91-98765-0214' },
        medicalHistory: [
          { condition: 'Pediatric Atopic Dermatitis', diagnosisDate: new Date('2023-10-02'), treatment: 'Emollient therapy and topical hydrocortisone' },
        ],
      },
    },
    {
      user: { firstName: 'Sunita', lastName: 'Verma', email: 'patient8@pulsecare.test', phone: '+91-98765-0215' },
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
      user: { firstName: 'Karan', lastName: 'Singhania', email: 'patient9@pulsecare.test', phone: '+91-98765-0217' },
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
      user: { firstName: 'Fatima', lastName: 'Khan', email: 'patient10@pulsecare.test', phone: '+91-98765-0219' },
      profile: {
        bloodGroup: 'B+' as const,
        allergies: ['Ciprofloxacin', 'Fluoroquinolones'],
        emergencyContact: { name: 'Zainab Khan', relationship: 'Mother', phone: '+91-98765-0220' },
        medicalHistory: [
          { condition: 'Polycystic Ovarian Syndrome (PCOS)', diagnosisDate: new Date('2022-08-25'), treatment: 'Lifestyle modification and Inositol supplement' },
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
      await p.save();
    } else {
      p.bloodGroup = item.profile.bloodGroup;
      p.allergies = item.profile.allergies;
      p.emergencyContact = item.profile.emergencyContact;
      p.medicalHistory = item.profile.medicalHistory;
      p.insuranceInfo = item.profile.insuranceInfo;
      await p.save();
    }
    patients.push(p);
  }

  // ---------------------------------------------------------------------------
  // 5. APPOINTMENTS WITH SEQUENTIAL QUEUE TOKENS (#1, #2, #3, ...) & ZERO DOUBLE-BOOKING
  // ---------------------------------------------------------------------------
  const pastMonday = getWeekdayDate('monday', -1);
  const pastTuesday = getWeekdayDate('tuesday', -1);
  const pastThursday = getWeekdayDate('thursday', -1);
  const todayMonday = getWeekdayDate('monday', 0); // Focus date for active daily queue token demonstration!
  const nextMonday = getWeekdayDate('monday', 1);
  const nextTuesday = getWeekdayDate('tuesday', 1);
  const nextWednesday = getWeekdayDate('wednesday', 1);

  const appointmentDefinitions = [
    // === CRITICAL QUEUE TOKEN DEMONSTRATION (Same Day, Same Doctor: Sequential Tokens #1, #2, #3, #4) ===
    // Dr. Arvind Sharma (Cardiology) on todayMonday:
    {
      patient: patients[0],
      doctor: docCardioSenior,
      date: todayMonday,
      timeSlot: '09:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Chest tightness evaluation & ECG review',
      notes: 'BP 138/88 mmHg. ECG shows normal sinus rhythm. Prescribed 30-day statin and lifestyle counseling.',
    },
    {
      patient: patients[1],
      doctor: docCardioSenior,
      date: todayMonday,
      timeSlot: '09:30',
      status: 'inProgress' as const,
      type: 'consultation' as const,
      reason: 'Hypertension follow-up & cardiac screening',
      notes: 'Patient currently undergoing vitals assessment in chamber.',
    },
    {
      patient: patients[2],
      doctor: docCardioSenior,
      date: todayMonday,
      timeSlot: '10:00',
      status: 'confirmed' as const,
      type: 'follow-up' as const,
      reason: 'Post-PTCA annual cardiac checkup & Doppler evaluation',
    },
    {
      patient: patients[3],
      doctor: docCardioSenior,
      date: todayMonday,
      timeSlot: '10:30',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Palpitations upon exertion',
    },

    // === PARALLEL SPECIALIST DEMONSTRATION (Same Specialty, Second Doctor: Dr. Vikram Iyer Starts at Token #1!) ===
    {
      patient: patients[4],
      doctor: docCardioJunior,
      date: todayMonday,
      timeSlot: '13:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Holter monitoring review for premature ventricular contractions',
      notes: 'Holter report demonstrates benign PVCs. Reassurance provided.',
    },
    {
      patient: patients[5],
      doctor: docCardioJunior,
      date: todayMonday,
      timeSlot: '13:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Resting pulse irregularity & stress test evaluation',
    },

    // === ORTHOPEDICS QUEUE (Dr. Rajesh Patel: Daily Tokens #1, #2 on todayMonday) ===
    {
      patient: patients[4],
      doctor: docOrthoSenior,
      date: todayMonday,
      timeSlot: '08:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Bilateral knee joint aspiration & cortisone injection',
      notes: 'Synovial fluid clear. Successfully administered 40mg Depo-Medrol per joint.',
    },
    {
      patient: patients[8],
      doctor: docOrthoSenior,
      date: todayMonday,
      timeSlot: '09:00',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Lumbar radiculopathy & severe lower back stiffness',
    },

    // === PEDIATRICS QUEUE (Dr. Sneha Kulkarni) ===
    {
      patient: patients[6], // Child Arjun Rao
      doctor: docPedsChief,
      date: todayMonday,
      timeSlot: '09:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'Pediatric eczema flare-up & 6-year immunization',
      notes: 'Administered DTaP/IPV booster. Prescribed non-steroidal topical barrier cream.',
    },
    {
      patient: patients[1],
      doctor: docPedsChief,
      date: todayMonday,
      timeSlot: '09:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Developmental milestones checkup',
    },

    // === EDGE CASES: CANCELLED & NO-SHOW APPOINTMENTS ===
    {
      patient: patients[5],
      doctor: docCardioSenior,
      date: pastMonday,
      timeSlot: '11:00',
      status: 'cancelled' as const,
      type: 'consultation' as const,
      reason: 'Cardio metabolic follow-up',
      cancelReason: 'Patient tested positive for COVID-19 - rescheduled to tele-triage',
    },
    {
      patient: patients[9],
      doctor: docMedSenior,
      date: pastTuesday,
      timeSlot: '14:00',
      status: 'noShow' as const,
      type: 'consultation' as const,
      reason: 'Annual routine wellness panel',
      notes: 'Patient did not arrive within 30 minutes of appointment window.',
    },

    // === PAST COMPLETED CLINICAL APPOINTMENTS ===
    {
      patient: patients[2], // Rohan Gupta
      doctor: docCardioSenior,
      date: pastThursday,
      timeSlot: '09:30',
      status: 'completed' as const,
      type: 'procedure' as const,
      reason: 'Diagnostic Coronary Angiogram & Echocardiography',
      notes: 'LAD stent patent. EF 55%. No new ischemic abnormalities.',
    },
    {
      patient: patients[7], // Sunita Verma (Geriatric)
      doctor: docMedSenior,
      date: pastMonday,
      timeSlot: '10:00',
      status: 'completed' as const,
      type: 'consultation' as const,
      reason: 'CKD routine metabolic review & Bone Mineral Density check',
      notes: 'eGFR 52 mL/min. Stable. Advised low phosphorus diet.',
    },

    // === UPCOMING FUTURE APPOINTMENTS (Next Week) ===
    {
      patient: patients[3],
      doctor: docNeuro,
      date: nextMonday,
      timeSlot: '10:00',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Recurrent atypical tension headache & visual aura investigation',
    },
    {
      patient: patients[9],
      doctor: docDerm,
      date: nextTuesday,
      timeSlot: '10:30',
      status: 'confirmed' as const,
      type: 'consultation' as const,
      reason: 'Persistent facial rosacea & patch allergy study',
    },
    {
      patient: patients[8],
      doctor: docOrthoSports,
      date: nextWednesday,
      timeSlot: '14:00',
      status: 'scheduled' as const,
      type: 'consultation' as const,
      reason: 'Post-physiotherapy MRI lumbar spine evaluation',
    },
  ];

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
  }

  // ---------------------------------------------------------------------------
  // 8. PRESCRIPTIONS LINKED TO CLINICAL CONSULTATIONS
  // ---------------------------------------------------------------------------
  const prescriptionsData = [
    // Cardiology prescription for Rohan Gupta
    {
      patientId: patients[2]._id,
      doctorId: docCardioSenior._id,
      appointmentId: createdAppointments[0]?._id,
      lineItems: [
        { drugId: createdDrugs[0]._id, drugName: createdDrugs[0].name, dosage: '20mg', frequency: 'Once daily at bedtime', duration: '30 days', quantity: 30 },
        { drugId: createdDrugs[1]._id, drugName: createdDrugs[1].name, dosage: '40mg', frequency: 'Once daily after breakfast', duration: '30 days', quantity: 30 },
        { drugId: createdDrugs[2]._id, drugName: createdDrugs[2].name, dosage: '25mg', frequency: 'Once daily morning', duration: '30 days', quantity: 30 },
      ],
      status: 'dispensed' as const,
      dispensedBy: receptionUser._id,
      dispensedAt: new Date(),
      notes: 'Maintain low salt diet. Target systolic BP < 130 mmHg. Review in 30 days.',
    },
    // Orthopedic prescription for Kabir Mehta
    {
      patientId: patients[4]._id,
      doctorId: docOrthoSenior._id,
      appointmentId: createdAppointments[6]?._id,
      lineItems: [
        { drugId: createdDrugs[6]._id, drugName: createdDrugs[6].name, dosage: '500mg', frequency: 'Twice daily with meals', duration: '60 days', quantity: 120 },
        { drugId: createdDrugs[8]._id, drugName: createdDrugs[8].name, dosage: '650mg', frequency: 'As needed for acute knee pain (max 2/day)', duration: '15 days', quantity: 15 },
      ],
      status: 'active' as const,
      notes: 'Avoid deep squats. Continue quadriceps isometric strengthening exercises.',
    },
  ];

  for (const rxData of prescriptionsData) {
    const existing = await Prescription.findOne({
      patientId: rxData.patientId,
      doctorId: rxData.doctorId,
      status: rxData.status,
    });
    if (!existing) {
      const rx = new Prescription(rxData);
      await rx.save();
    }
  }

  // ---------------------------------------------------------------------------
  // 9. ITEMIZED BILLING & TAX INVOICES (Showcasing all invoice statuses & receipts!)
  // ---------------------------------------------------------------------------
  const invoiceDefinitions = [
    // 1. PAID INVOICE - Full Payment with Card & Itemized Tax (Rohan Gupta)
    {
      patient: patients[2]._id,
      appointment: createdAppointments[0]?._id,
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

    // 2. PARTIALLY PAID INVOICE - Demonstrating Active Outstanding Balance (Kabir Mehta)
    {
      patient: patients[4]._id,
      appointment: createdAppointments[6]?._id,
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

    // 3. ISSUED INVOICE - Clean Billed Invoice Awaiting Settlement (Diya Patel)
    {
      patient: patients[1]._id,
      appointment: createdAppointments[1]?._id,
      lineItems: [
        { description: 'Pediatric Development & Health Evaluation', quantity: 1, unitPrice: 800, category: 'consultation' as const },
        { description: 'Pediatric DTaP & MMR Booster Immunization Administration', quantity: 1, unitPrice: 1400, category: 'procedure' as const },
        { description: 'Oral Rehydration & Pediatric Vitamin D3 Drops', quantity: 1, unitPrice: 320, category: 'medicine' as const },
      ],
      taxRate: 5,
      discount: 0,
      status: 'issued' as const,
      issuedDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      notes: 'Issued at discharge desk. Please remit payment within 14 business days.',
    },

    // 4. DRAFT INVOICE - Clinical In-Progress Draft Bill (Aarav Sharma)
    {
      patient: patients[0]._id,
      appointment: createdAppointments[3]?._id,
      lineItems: [
        { description: 'Emergency Department Physician Consultation', quantity: 1, unitPrice: 700, category: 'consultation' as const },
        { description: 'Intravenous Cannulation & Normal Saline Infusion (500ml)', quantity: 2, unitPrice: 300, category: 'procedure' as const },
        { description: 'Cardiac Telemetry & Continuous Vitals Monitoring (4 Hours)', quantity: 4, unitPrice: 300, category: 'other' as const },
      ],
      taxRate: 5,
      discount: 100,
      status: 'draft' as const,
      notes: 'Pending final review before formal invoice issuance.',
    },

    // 5. OVERDUE INVOICE - Edge Case: Due Date Elapsed in Past (Sunita Verma)
    {
      patient: patients[7]._id,
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
  ];

  for (const invDef of invoiceDefinitions) {
    const existing = await Invoice.findOne({
      patient: invDef.patient,
      notes: invDef.notes,
    });
    if (!existing) {
      const inv = new Invoice({
        ...invDef,
        issuedBy: receptionUser._id,
      });
      await inv.save();
    }
  }

  // ---------------------------------------------------------------------------
  // 10. LAB ORDERS & DIAGNOSTIC RESULTS
  // ---------------------------------------------------------------------------
  const labOrdersData = [
    {
      patient: patients[2]._id, // Rohan Gupta
      doctor: docCardioSenior._id,
      priority: 'urgent' as const,
      status: 'completed' as const,
      notes: 'Evaluate post-stent cardiac biomarkers and lipid targets',
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
        orderedAt: new Date(Date.now() - 3 * 86400000),
      });
      await order.save();

      if (loData.results && loData.results.length > 0) {
        const labRes = new LabResult({
          labOrder: order._id,
          patient: loData.patient,
          results: loData.results,
          status: 'final',
          technician: adminUser._id,
          verifiedBy: loData.doctor,
          resultedAt: new Date(Date.now() - 2 * 86400000),
          verifiedAt: new Date(Date.now() - 2 * 86400000),
        });
        await labRes.save();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 11. CLINICAL DOCUMENTS (Certificates, Discharge Summaries & Referrals)
  // ---------------------------------------------------------------------------
  const clinicalDocs = [
    {
      documentId: 'DOC-2026-0001',
      type: 'medical_certificate' as const,
      patientId: patients[8]._id, // Karan Singhania
      issuedBy: docOrthoSenior._id,
      status: 'issued' as const,
      issuedAt: new Date(Date.now() - 5 * 86400000),
      content: 'Certified that Mr. Karan Singhania is undergoing treatment for Acute Lumbar Radiculopathy and is advised rest from heavy lifting and prolonged standing for 14 days.',
      notes: 'Medical fitness certificate for workplace leave accommodation.',
    },
    {
      documentId: 'DOC-2026-0002',
      type: 'discharge_summary' as const,
      patientId: patients[2]._id, // Rohan Gupta
      issuedBy: docCardioSenior._id,
      status: 'issued' as const,
      issuedAt: new Date(Date.now() - 12 * 86400000),
      content: 'Diagnosis: CAD Post-PTCA. Hospital Course: Uneventful elective diagnostic study. Stable hemodynamics at discharge. Meds: DAPT, Statin, Beta-blocker.',
      notes: 'Formal cardiology day-care discharge summary.',
    },
    {
      documentId: 'DOC-2026-0003',
      type: 'referral' as const,
      patientId: patients[3]._id, // Ananya Deshmukh
      issuedBy: docMedSenior._id,
      status: 'issued' as const,
      issuedAt: new Date(),
      content: 'Referred to Dr. Radhika Menon (Neurology) for evaluation of persistent unilateral headache with visual scotoma.',
      notes: 'Inter-departmental specialist clinical referral.',
    },
  ];

  for (const doc of clinicalDocs) {
    const existing = await ClinicalDoc.findOne({ documentId: doc.documentId });
    if (!existing) {
      const d = new ClinicalDoc(doc);
      await d.save();
    }
  }

  // ---------------------------------------------------------------------------
  // 12. ROLE-BASED SYSTEM NOTIFICATIONS
  // ---------------------------------------------------------------------------
  const systemNotifications = [
    {
      user: adminUser._id,
      title: 'Low Pharmacy Stock Alert',
      message: 'Amoxicillin 625mg (18 units) & Budesonide Rotacaps (14 units) are below minimum reorder thresholds.',
      type: 'inventory' as const,
      read: false,
    },
    {
      user: adminUser._id,
      title: 'Overdue Tax Invoice Alert',
      message: 'Invoice #INV-2026-0005 for Sunita Verma (₹3,517.50) is 10 days past due date.',
      type: 'billing' as const,
      read: false,
    },
    {
      user: receptionUser._id,
      title: 'Queue Token Check-In',
      message: 'Patient Aarav Sharma checked in for Daily Queue Token #1 with Dr. Arvind Sharma.',
      type: 'appointment' as const,
      read: false,
    },
    {
      user: doc1User._id, // Dr. Arvind Sharma
      title: 'Leave Approved & Slot Blackout Active',
      message: 'Your leave request for Next Wednesday to Friday has been approved. Automated slot blackout active in appointment roster.',
      type: 'system' as const,
      read: false,
    },
    {
      user: doc1User._id,
      title: 'Critical Lab Result Verified',
      message: 'High-Sensitivity Troponin-I results for patient Rohan Gupta are ready and verified normal (<0.04 ng/mL).',
      type: 'appointment' as const,
      read: true,
    },
  ];

  for (const notif of systemNotifications) {
    const existing = await Notification.findOne({
      user: notif.user,
      title: notif.title,
    });
    if (!existing) {
      const n = new Notification(notif);
      await n.save();
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
