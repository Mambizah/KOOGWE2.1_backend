import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PaymentMethod, RideStatus } from "@prisma/client";
import { RidesService } from "./rides.service";

describe("RidesService", () => {
  let ridesService: RidesService;
  let prismaMock: any;
  let gatewayMock: any;
  let mailMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      ride: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      driverProfile: {
        update: jest.fn(),
      },
    };
    gatewayMock = {
      notifyDrivers: jest.fn(),
      notifyPassenger: jest.fn(),
      notifyRideRoom: jest.fn(),
    };
    mailMock = {
      sendRideValidationEmail: jest.fn(),
      sendDriverAssignedEmail: jest.fn(),
      sendRideCompletedEmail: jest.fn(),
    };

    ridesService = new RidesService(prismaMock, gatewayMock, mailMock);
  });

  it("should correctly estimate price for ECO ride", () => {
    const result = ridesService.estimatePrice({
      distanceKm: 5,
      durationMin: 10,
      vehicleType: "ECO",
      zone: "centre",
      horaire: "normal",
      trafic: "modere",
      meteo: "normale",
      demande: "normale",
    });

    expect(result).toHaveProperty("estimatedPrice");
    expect(result.estimatedPrice).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
  });

  it("should reject acceptRide when driver profile is incomplete", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "driver1",
      role: "DRIVER",
      driverProfile: {
        faceVerified: false,
        documentsUploaded: false,
        adminApproved: false,
        vehicleMake: null,
        vehicleModel: null,
        licensePlate: null,
      },
    });

    await expect(
      ridesService.acceptRide("ride1", "driver1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("should acceptRide when driver profile is complete and ride is requested", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "driver2",
      role: "DRIVER",
      driverProfile: {
        faceVerified: true,
        documentsUploaded: true,
        adminApproved: true,
        vehicleMake: "Toyota",
        vehicleModel: "Yaris",
        licensePlate: "AB-123-CD",
      },
    });
    prismaMock.ride.findUnique.mockResolvedValue({
      id: "ride2",
      status: RideStatus.REQUESTED,
      passengerId: "p1",
    });
    prismaMock.ride.update.mockResolvedValue({
      id: "ride2",
      status: RideStatus.ACCEPTED,
      passengerId: "p1",
      driverId: "driver2",
      passenger: {
        id: "p1",
        name: "John",
        phone: "0123456789",
        email: "p@test.com",
      },
      driver: {
        id: "driver2",
        name: "Driver",
        phone: "0987654321",
        email: "d@test.com",
      },
    });

    const updated = await ridesService.acceptRide("ride2", "driver2");

    expect(updated.status).toBe(RideStatus.ACCEPTED);
    expect(prismaMock.ride.update).toHaveBeenCalledWith(expect.anything());
    expect(gatewayMock.notifyPassenger).toHaveBeenCalledWith(
      "p1",
      "ride_accepted",
      expect.anything(),
    );
    expect(mailMock.sendDriverAssignedEmail).toHaveBeenCalled();
  });

  it("should update status in sequence and complete ride", async () => {
    const existingRide: any = {
      id: "ride3",
      status: RideStatus.ACCEPTED,
      driverId: "driver2",
      paymentMethod: PaymentMethod.CARD,
      price: 12.5,
      passenger: { id: "p1", email: "p@test.com" },
      driver: { id: "driver2", name: "Driver", email: "d@test.com" },
    };
    prismaMock.ride.findUnique.mockResolvedValue(existingRide);
    prismaMock.ride.update.mockResolvedValue({
      ...existingRide,
      status: RideStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    const inProgress = await ridesService.updateStatus(
      "ride3",
      "driver2",
      RideStatus.IN_PROGRESS,
    );
    expect(inProgress.status).toBe(RideStatus.IN_PROGRESS);

    prismaMock.ride.findUnique.mockResolvedValue({
      ...existingRide,
      status: RideStatus.IN_PROGRESS,
    });
    prismaMock.ride.update.mockResolvedValue({
      ...existingRide,
      status: RideStatus.COMPLETED,
      completedAt: new Date(),
    });

    const completed = await ridesService.updateStatus(
      "ride3",
      "driver2",
      RideStatus.COMPLETED,
    );
    expect(completed.status).toBe(RideStatus.COMPLETED);
    expect(prismaMock.driverProfile.update).toHaveBeenCalled();
    expect(mailMock.sendRideCompletedEmail).toHaveBeenCalledWith("p@test.com", {
      rideId: "ride3",
      price: 12.5,
    });
  });

  it("should reject acceptRide when ride is not requested", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "driver3",
      role: "DRIVER",
      driverProfile: {
        faceVerified: true,
        documentsUploaded: true,
        adminApproved: true,
        vehicleMake: "VW",
        vehicleModel: "Golf",
        licensePlate: "AA-111-BB",
      },
    });
    prismaMock.ride.findUnique.mockResolvedValue({
      id: "ride4",
      status: RideStatus.ACCEPTED,
      passengerId: "p2",
    });

    await expect(
      ridesService.acceptRide("ride4", "driver3"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should cancel ride for passenger and driver", async () => {
    prismaMock.ride.findUnique.mockResolvedValue({
      id: "ride5",
      status: RideStatus.REQUESTED,
      passengerId: "p1",
      driverId: "driver1",
      passenger: { id: "p1", email: "p@test.com" },
      driver: { id: "driver1", email: "d@test.com" },
    });
    prismaMock.ride.update.mockResolvedValue({
      id: "ride5",
      status: RideStatus.CANCELLED,
      passengerId: "p1",
      driverId: "driver1",
    });

    const pCancelled = await ridesService.cancelRide(
      "ride5",
      "p1",
      "PASSENGER",
    );
    expect(pCancelled.status).toBe(RideStatus.CANCELLED);

    prismaMock.ride.findUnique.mockResolvedValue({
      id: "ride5",
      status: RideStatus.REQUESTED,
      passengerId: "p1",
      driverId: "driver1",
      passenger: { id: "p1", email: "p@test.com" },
      driver: { id: "driver1", email: "d@test.com" },
    });
    const dCancelled = await ridesService.cancelRide(
      "ride5",
      "driver1",
      "DRIVER",
    );
    expect(dCancelled.status).toBe(RideStatus.CANCELLED);
  });

  it("should rate completed ride", async () => {
    prismaMock.ride.findUnique.mockResolvedValue({
      id: "ride6",
      status: RideStatus.COMPLETED,
      passengerId: "p1",
      driverId: "driver1",
    });
    prismaMock.ride.update.mockResolvedValue({ id: "ride6", driverRating: 5 });

    const res = await ridesService.rateRide(
      "ride6",
      "p1",
      "PASSENGER",
      5,
      "Top !",
    );
    expect(res).toHaveProperty("driverRating");

    await expect(
      ridesService.rateRide("ride6", "x", "PASSENGER", 4),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prismaMock.ride.findUnique.mockResolvedValue({
      id: "ride7",
      status: RideStatus.IN_PROGRESS,
      passengerId: "p1",
      driverId: "driver1",
    });
    await expect(
      ridesService.rateRide("ride7", "p1", "PASSENGER", 4),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
