export declare enum UserRole {
    PASSENGER = "PASSENGER",
    DRIVER = "DRIVER",
    ADMIN = "ADMIN"
}
export declare class CreateAuthDto {
    email: string;
    password: string;
    name?: string;
    phone?: string;
    role?: UserRole;
}
