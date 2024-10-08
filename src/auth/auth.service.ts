import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { CreateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { PaginationDto } from 'src/common/dtos/pagination.dto';


@Injectable()
export class AuthService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService

  ) {}

  // Crear un nuevo usuario
  async create(createUserDto: CreateUserDto) {
    
    try {

      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync( password, 10 )
      });
      
      await this.userRepository.save( user );

      delete user.password;

      return {
        ...user,
        token: this.getJwtToken({ id: user.id, fullName: user.fullName } as JwtPayload)
      };

    } catch (error) {
      this.handleDBErrors( error );
    }

  }

  // Login de usuario
  async login( loginUserDto: LoginUserDto ) {

    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true, fullName: true, roles: true }
    });

    if ( !user ) throw new UnauthorizedException('Credenciales no válidas');

    if ( !bcrypt.compareSync( password, user.password ) ) throw new UnauthorizedException('Credenciales no válidas');

    return {
      ...user,
      token: this.getJwtToken({ id: user.id, fullName: user.fullName, roles: user.roles } as JwtPayload)
    }

  }

  //traer todos los usuarios
  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
  
    const [users, total] = await this.userRepository.findAndCount({
      take: limit,
      skip: offset,
    });
  
    return { users, total };
  }

  
  // Verificar el estado de autenticación
  async checkAuthStatus( user: User ) {
    return {
      ...user,
      token: this.getJwtToken({ id: user.id, fullName: user.fullName } as JwtPayload)
    }
  }

  // Generar un token JWT
  private getJwtToken( payload: JwtPayload ) {

    const token = this.jwtService.sign( payload );

    return token;
  }

  private handleDBErrors( error: any ): never {

    if ( error.code === '23505' ) {
      throw new BadRequestException( error.detail );
    }

    console.log( error );

    throw new InternalServerErrorException('Error desconocido, por favor checar los logs del servidor');

  }
}
