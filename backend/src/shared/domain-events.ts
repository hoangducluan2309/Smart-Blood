import { EventEmitter } from 'node:events';

export interface DomainEventMap {
  'donor:checkin_submitted': {
    eventId: string;
    checkInId: string;
    stt: number;
    hoTen: string;
    buocHienTai: string;
    thoiGianCheckIn: Date;
  };
  'medical:step_updated': {
    eventId: string;
    checkInId: string;
    stt: number;
    buocHienTai: string;
    lyDoTamHoan?: string | null;
  };
  'event:progress_updated': {
    eventId: string;
    soLuongThucTe: number;
  };
  'inventory:stock_changed': {
    nhomMau: string;
    rhFactor: string;
    action: string;
  };
  'emergency:red_alert': {
    emergencyId: string;
    hospitalId: string;
    tenBenhVien: string;
    maBenhAn: string;
    nhomMauCan: string;
    rhFactor: string;
    soLuongTui: number;
    mucDoKhan: string;
    createdAt: Date;
  };
  'hospital:bag_received': {
    bagId: string;
    maVachTuiMau: string;
    tenBenhVien: string;
    nhomMau: string;
    rhFactor: string;
  };
}

class TypedDomainEventBus {
  private readonly emitter = new EventEmitter();

  public emit<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  public on<K extends keyof DomainEventMap>(
    event: K,
    listener: (payload: DomainEventMap[K]) => void,
  ): void {
    this.emitter.on(event, listener);
  }

  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

export const domainEvents = new TypedDomainEventBus();
