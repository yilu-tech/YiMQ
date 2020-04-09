"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
var common_1 = require("@nestjs/common");
var microservices_1 = require("@nestjs/microservices");
var path_1 = require("path");
var transport_enum_1 = require("@nestjs/microservices/enums/transport.enum");
var ClientModule = /** @class */ (function () {
    function ClientModule() {
    }
    ClientModule = __decorate([
        common_1.Module({
            imports: [
                microservices_1.ClientsModule.register([
                    {
                        name: 'HERO_PACKAGE',
                        transport: transport_enum_1.Transport.GRPC,
                        options: {
                            package: 'hero',
                            protoPath: path_1.join(process.cwd(), 'protos/hero.proto')
                        }
                    },
                ]),
            ],
            controllers: []
        })
    ], ClientModule);
    return ClientModule;
}());
exports.ClientModule = ClientModule;
