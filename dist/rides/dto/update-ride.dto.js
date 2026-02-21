"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRideDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_ride_dto_1 = require("./create-ride.dto");
class UpdateRideDto extends (0, mapped_types_1.PartialType)(create_ride_dto_1.CreateRideDto) {
}
exports.UpdateRideDto = UpdateRideDto;
//# sourceMappingURL=update-ride.dto.js.map