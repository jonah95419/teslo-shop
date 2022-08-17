import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, LoginUserDto } from './dto';
import { JwtPayload } from './interfaces';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;
      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });

      await this.userRepository.save(user);

      delete user.password;

      return { ...user, token: this.getJWTToken({ id: user.id }) };
    } catch (error) {
      this.handlerDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;
    const { id, ...user } = await this.userRepository.findOne({
      where: { email },
      select: { password: true, email: true, id: true },
    });

    if (!user)
      throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');

    return { ...user, token: this.getJWTToken({ id }) };
  }

  checkAuthStatus(user: User) {
    return { ...user, token: this.getJWTToken({ id: user.id }) };
  }

  private getJWTToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private handlerDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    console.log(error);

    throw new InternalServerErrorException('Please check server logs');
  }
}
