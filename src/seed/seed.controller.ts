import { Controller, Get } from '@nestjs/common';
import {ApiTags} from "@nestjs/swagger";
import { SeedService } from './seed.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  // @Auth(ValidRoles.user)
  executeSeed() {
    return this.seedService.runSeed();
  }
}
