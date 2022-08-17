import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { Product, ProductImage } from './entities';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class ProductsService {
  private readonly _logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    user: User,
  ): Promise<Product> {
    try {
      const { images = [], ...productDetails } = createProductDto;

      const product: Product = this.productRepository.create({
        ...productDetails,
        images: images.map((image: string) =>
          this.productImageRepository.create({ url: image }),
        ),
        user,
      });

      await this.productRepository.save(product);

      return product;
    } catch (error) {
      this.handlerDBExceptions(error);
    }
  }

  async findAll(pagintationDto: PaginationDto): Promise<object[]> {
    const { limit = 10, offset = 0 } = pagintationDto;

    const products: Product[] = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true,
      },
    });

    return products.map((product: Product) => ({
      ...product,
      images: product.images.map((image: ProductImage) => image.url),
    }));
  }

  async findOnePlain(term: string) {
    const { images = [], ...res } = await this.findOne(term);

    return {
      ...res,
      images: images.map((image) => image.url),
    };
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    user: User,
  ): Promise<object> {
    await this.findOne(id);

    const { images, ...toUpdate } = updateProductDto;
    const product: Product = await this.productRepository.preload({
      id,
      ...toUpdate,
    });
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });

        product.images = images.map((image: string) =>
          this.productImageRepository.create({ url: image }),
        );
      }

      product.user = user;

      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      // await this.productRepository.save(product);

      return this.findOnePlain(id);
    } catch (e) {
      await queryRunner.rollbackTransaction();

      this.handlerDBExceptions(e);
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<Product> {
    const product: Product = await this.findOne(id);

    return await this.productRepository.remove(product);
  }

  async removeAllProducts() {
    const query = this.productRepository.createQueryBuilder('prod');

    try {
      return await query.delete().where({}).execute();
    } catch (e) {
      this.handlerDBExceptions(e);
    }
  }

  private async findOne(term: string): Promise<Product> {
    let product: Product;

    if (isUUID(term))
      product = await this.productRepository.findOneBy({ id: term });
    else {
      const termOfSearch = {
        slug: term.toLowerCase(),
        title: term.toUpperCase(),
      };
      const queryOfSearch = 'UPPER(title) =:title or slug =:slug';
      const queryBuilder: SelectQueryBuilder<Product> =
        this.productRepository.createQueryBuilder('prod');

      product = await queryBuilder
        .where(queryOfSearch, termOfSearch)
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if (!product)
      throw new NotFoundException(`Product with term ${term} not found`);

    return product;
  }

  private handlerDBExceptions(error: any) {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    this._logger.error(error);

    throw new InternalServerErrorException(
      'Unexpected error, check server logs',
    );
  }
}
