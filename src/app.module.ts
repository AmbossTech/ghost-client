import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NodeModule } from './node/node.module';
import { TerminusModule } from '@nestjs/terminus';
import { AppController } from './app.controller';

@Module({
  imports: [
    NodeModule,
    TerminusModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
