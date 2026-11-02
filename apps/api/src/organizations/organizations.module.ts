import { Global, Module } from "@nestjs/common";
import { Policy } from "./policy";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationLogoService } from "./organization-logo.service";
@Global()
@Module({
  providers: [Policy, OrganizationsService, OrganizationLogoService],
  controllers: [OrganizationsController],
  exports: [Policy],
})
export class OrganizationsModule {}
