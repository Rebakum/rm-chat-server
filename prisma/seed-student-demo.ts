// One-off script to seed a few demo bookings/custom orders for a student so
// the new "Service Bookings & Custom Orders" dashboard section has data to
// show while testing. Safe to re-run (creates a fresh small batch each time).
import prisma from "../src/lib/prisma";

async function main() {
  const student = await prisma.user.findFirst({
    where: { role: "student", name: { contains: "Sultana", mode: "insensitive" } },
  });
  if (!student) throw new Error("Demo student not found");

  const services = await prisma.service.findMany({ take: 2 });
  if (services.length === 0) throw new Error("No services found to book");

  const teacherIds = [...new Set(services.map((s) => s.teacherId))];

  // 1) Ongoing service booking (pending, unpaid)
  await prisma.booking.create({
    data: {
      bookingType: "Service",
      serviceId: services[0].id,
      userId: student.id,
      teacherId: services[0].teacherId,
      bookingPrice: services[0].price,
      adminHoldAmount: 0,
      status: "pending",
      paymentStatus: "unpaid",
    },
  });

  // 2) Ongoing service booking (accepted, paid) — second service if available
  const secondService = services[1] ?? services[0];
  await prisma.booking.create({
    data: {
      bookingType: "Service",
      serviceId: secondService.id,
      userId: student.id,
      teacherId: secondService.teacherId,
      bookingPrice: secondService.price,
      adminHoldAmount: secondService.price,
      status: "accepted",
      paymentStatus: "paid",
    },
  });

  // 3) Completed service booking (history)
  await prisma.booking.create({
    data: {
      bookingType: "Service",
      serviceId: services[0].id,
      userId: student.id,
      teacherId: services[0].teacherId,
      bookingPrice: services[0].price,
      adminHoldAmount: services[0].price,
      status: "completed",
      paymentStatus: "paid",
      studentConfirmed: true,
      teacherConfirmed: true,
      completedByAdmin: true,
      completedAt: new Date(),
    },
  });

  // 4) Ongoing custom order + its auto-linked booking (mirrors customOrder.service.create)
  const order1 = await prisma.customOrder.create({
    data: {
      subject: "Weekend Tajweed Practice",
      totalHours: 10,
      hourlyRate: 8,
      totalPrice: 80,
      teacherId: teacherIds[0],
      userId: student.id,
      status: "Pending",
    },
  });
  await prisma.booking.create({
    data: {
      bookingType: "Custom",
      customOrderId: order1.id,
      userId: student.id,
      teacherId: order1.teacherId,
      bookingPrice: order1.totalPrice,
      adminHoldAmount: order1.totalPrice,
      status: "pending",
      paymentStatus: "unpaid",
    },
  });

  // 5) Completed custom order (history)
  const order2 = await prisma.customOrder.create({
    data: {
      subject: "Intensive Hifz Revision — 2 weeks",
      totalHours: 20,
      hourlyRate: 10,
      totalPrice: 200,
      teacherId: teacherIds[teacherIds.length - 1],
      userId: student.id,
      status: "Completed",
    },
  });
  await prisma.booking.create({
    data: {
      bookingType: "Custom",
      customOrderId: order2.id,
      userId: student.id,
      teacherId: order2.teacherId,
      bookingPrice: order2.totalPrice,
      adminHoldAmount: order2.totalPrice,
      status: "completed",
      paymentStatus: "paid",
      studentConfirmed: true,
      teacherConfirmed: true,
      completedByAdmin: true,
      completedAt: new Date(),
    },
  });

  console.log(`Seeded demo bookings + custom orders for ${student.name} (${student.email})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
