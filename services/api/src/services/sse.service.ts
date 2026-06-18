import { Injectable } from "@nestjs/common";
import { Subject, Observable } from "rxjs";

@Injectable()
export class SseService {
  private readonly eventSubject = new Subject<unknown>();

  getEventStream(): Observable<unknown> {
    return this.eventSubject.asObservable();
  }

  async publish(event: { type: string; payload: unknown }) {
    this.eventSubject.next(event);
  }
}
