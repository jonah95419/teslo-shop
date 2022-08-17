import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { initialData } from './data/seed-data';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SeedService {
  constructor(
    private readonly productsService: ProductsService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async runSeed() {
    await this.deleteTables();
    const adminUSer = await this.insertUsers();

    await this.insertNewProducts(adminUSer);

    return 'SEED EXECUTED';
  }

  private async deleteTables() {
    await this.productsService.removeAllProducts();

    const queryBuilder = this.userRepository.createQueryBuilder();
    await queryBuilder.delete().where({}).execute();
  }

  private async insertUsers() {
    const seedUsers = initialData.users;
    const users: User[] = [];

    seedUsers.forEach((user) => users.push(this.userRepository.create(user)));

    const dbUSers = await this.userRepository.save(users);

    return dbUSers[0];
  }

  private async insertNewProducts(user: User) {
    await this.productsService.removeAllProducts();

    const products = initialData.products;
    const insertPromises = products.map((product) =>
      this.productsService.create(product, user),
    );

    await Promise.all(insertPromises);
  }
}
