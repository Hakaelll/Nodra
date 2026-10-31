import {Global,Module} from '@nestjs/common';
import {Policy} from './policy';
import {OrganizationsService} from './organizations.service';
import {OrganizationsController} from './organizations.controller';
@Global() @Module({providers:[Policy,OrganizationsService],controllers:[OrganizationsController],exports:[Policy]}) export class OrganizationsModule {}
