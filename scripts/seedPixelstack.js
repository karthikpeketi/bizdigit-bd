const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Payment = require('../models/Payment');

dotenv.config({ path: '../.env' }); // Adjust path as needed depending on where it's run

const seedPixelStack = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/bussinessDig';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const PIXELSTACK_ID = '6a021bad469a45a8d72cf1b3';

    // 1. Update Business Profile
    const updatedUser = await User.findByIdAndUpdate(
      PIXELSTACK_ID,
      {
        $set: {
          contactNumber: "+44 20 7946 0123",
          businessEmail: "hello@pixelstack.uk",
          businessType: "Software Development",
          businessAddress: "128 City Road, London, EC1V 2NX, UK",
          dailyFootfall: "Low",
          peakHours: "Afternoon",
          workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          targetAudience: "Professionals",
          numberOfEmployees: "Small",
          currentMarketing: ["LinkedIn", "Email", "Referral"],
          onlinePresence: "Active",
          websiteUrl: "https://pixelstack.uk",
          socialMediaLink: "https://linkedin.com/company/pixelstack",
          acceptsCardPayments: "Yes",
          acceptsCash: "No",
          monthlyTransactions: "Medium",
          averageOrderValue: "High",
          status: "approved"
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      console.log('User not found with ID: ' + PIXELSTACK_ID);
      process.exit(1);
    }

    // 2. Clear existing payments
    await Payment.deleteMany({ userId: PIXELSTACK_ID });

    // 3. Create Payment History
    const payments = [
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Digital Ventures Ltd",
        senderEmail: "finance@digitalventures.com",
        amount: 1250,
        currency: "gbp",
        description: "Software Subscription - Annual",
        paymentPurpose: "Subscription",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "John Smith",
        senderEmail: "jsmith@freelance.co.uk",
        amount: 850,
        currency: "gbp",
        description: "UI/UX Design Consultation",
        paymentPurpose: "Service Fee",
        paymentMode: "CreditCard",
        status: "success",
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Global Retail Corp",
        senderEmail: "billing@globalretail.com",
        amount: 2100,
        currency: "gbp",
        description: "Custom API Integration",
        paymentPurpose: "Project Payment",
        paymentMode: "NetBanking",
        status: "success",
        paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Sarah Connor",
        senderEmail: "sarah@skynet.net",
        amount: 450,
        currency: "gbp",
        description: "Monthly Maintenance",
        paymentPurpose: "Maintenance",
        paymentMode: "Wallet",
        status: "success",
        paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Tech Innovators",
        senderEmail: "payments@techinn.com",
        amount: 1500,
        currency: "gbp",
        description: "Cloud Hosting Setup",
        paymentPurpose: "Infrastructure",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Domain Registrar Inc",
        senderEmail: "billing@domainreg.com",
        amount: 95,
        currency: "gbp",
        description: "Domain Renewal",
        paymentPurpose: "Subscription",
        paymentMode: "DebitCard",
        status: "success",
        paidAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "StartUp Hub",
        senderEmail: "hello@startuphub.com",
        amount: 3000,
        currency: "gbp",
        description: "Mobile App MVP - Milestone 1",
        paymentPurpose: "Project Payment",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Marketing Solutions",
        senderEmail: "finance@marketingsol.com",
        amount: 500,
        currency: "gbp",
        description: "Strategy Consultation",
        paymentPurpose: "Consultation",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
      }
    ];

    await Payment.insertMany(payments);

    console.log('PixelStack seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedPixelStack();
