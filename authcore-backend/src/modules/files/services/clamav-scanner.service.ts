import { Socket } from 'node:net';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ScanResult,
  VirusScanner,
} from '../interfaces/virus-scanner.interface';

/** clamd's INSTREAM chunk size (must stay below its StreamMaxLength). */
const CHUNK_SIZE = 64 * 1024;
const MAX_RESPONSE_LENGTH = 1024;

/**
 * ClamAV over the clamd TCP protocol (INSTREAM), no extra dependency:
 * `z`-prefixed commands, 4-byte big-endian length-prefixed chunks, a zero
 * length to finish; the answer is "stream: OK" or "stream: <name> FOUND".
 * Run clamd with e.g. `docker run -d -p 3310:3310 clamav/clamav`.
 */
@Injectable()
export class ClamavScannerService implements VirusScanner, OnModuleInit {
  readonly name = 'clamav';
  readonly isEnabled: boolean;
  private readonly logger = new Logger(ClamavScannerService.name);
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    this.isEnabled = configService.getOrThrow<boolean>(
      'storage.virusScan.isEnabled',
    );
    this.host = configService.getOrThrow<string>('storage.virusScan.host');
    this.port = configService.getOrThrow<number>('storage.virusScan.port');
    this.timeoutMs = configService.getOrThrow<number>(
      'storage.virusScan.timeoutMs',
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(
        'Virus scanning of uploads is disabled (VIRUS_SCAN_ENABLED=false)',
      );
      return;
    }
    const isUp = await this.ping();
    this.logger[isUp ? 'log' : 'warn']({
      message: isUp
        ? 'ClamAV reachable'
        : 'ClamAV not reachable (uploads follow VIRUS_SCAN_FAIL_CLOSED)',
      host: this.host,
      port: this.port,
    });
  }

  async scan(data: Buffer): Promise<ScanResult> {
    const chunks: Buffer[] = [Buffer.from('zINSTREAM\0')];
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.subarray(offset, offset + CHUNK_SIZE);
      const size = Buffer.alloc(4);
      size.writeUInt32BE(chunk.length);
      chunks.push(size, chunk);
    }
    chunks.push(Buffer.alloc(4));
    const answer = await this.exchange(Buffer.concat(chunks));
    if (/^stream: OK$/.test(answer)) {
      return { isInfected: false, signature: null };
    }
    const found = /^stream: (.+) FOUND$/.exec(answer);
    if (found?.[1]) {
      return { isInfected: true, signature: found[1] };
    }
    throw new Error(`Unexpected ClamAV answer: ${answer.slice(0, 200)}`);
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.exchange(Buffer.from('zPING\0'))) === 'PONG';
    } catch {
      return false;
    }
  }

  /** Sends one command, returns clamd's answer (NUL-terminated, trimmed). */
  private exchange(payload: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const received: Buffer[] = [];
      let length = 0;
      const fail = (error: Error) => {
        socket.destroy();
        reject(error);
      };
      socket.setTimeout(this.timeoutMs, () => {
        fail(new Error('ClamAV timed out'));
      });
      socket.once('error', fail);
      socket.on('data', (data: Buffer) => {
        received.push(data);
        length += data.length;
        if (length > MAX_RESPONSE_LENGTH) {
          fail(new Error('ClamAV answer too long'));
        }
      });
      socket.once('end', () => {
        socket.destroy();
        resolve(
          Buffer.concat(received).toString('utf8').replace(/\0/g, '').trim(),
        );
      });
      socket.connect(this.port, this.host, () => {
        socket.end(payload);
      });
    });
  }
}
