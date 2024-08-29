import { getSubscription, SUBSCRIPTIONS } from './../subscription';
import { RBAC } from "../rbac/rbac";
import { SecureSession } from "../session";
import { CounterView } from "./counter";
import { SessionsView } from "./session";
import { TraceView } from "./trace";

export default class ViewFactory {
  /**
   * Creates a new ViewFactory instance.
   * @param session session instance
   * @param rbac rbac instance
   * @param godMode override all restrictions
   */
  constructor() {
  }

  TextResponse(session: SecureSession, text: string) {
    return session.setSessionCookies(new Response(text, { headers: { "Content-Type": "text/plain;charset=UTF-8" } }));
  }

  // Define a response for HTML content
  HTMLResponse(session: SecureSession, view: string) {
    return session.setSessionCookies(new Response(view, { headers: { "Content-Type": "text/html;charset=UTF-8" } }));
  }

  // Define a response for PNG content
  PNGResponse(view: string) {
    return new Response(view, { headers: { 'Content-Type': 'image/png' } });
  }

  pixel() {
    // Base64 encoded 1x1 transparent PNG
    const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8=';
    
    // Decode the Base64 string to a Uint8Array
    const binaryString = atob(transparentPixel);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(bytes, {
      headers: { 
        'Content-Type': 'image/png'
      },
    })
  }

  notFound = () => new Response("Not found", { status: 404 });

  /**
   * Creates a new PixelView instance
   * @param request Cloudflare Workers Request object
   * @returns A SecureSession object with unique Id
   */
  createTraceView(session: SecureSession, data: string = ""): Response {
    return this.HTMLResponse(session, TraceView(data));
  }

  /**
   * Creates a new CounterView instance
   * @param request Cloudflare Workers Request object
   * @returns A SecureSession object with unique Id
   */
  createCounterView(session: SecureSession, names: string[], sessions: string[], name: string = "", count: number = 0, dataUrl: string = "/", tracker: string = ''): Response  {
    let subscriptionOverrideId
    try {
      subscriptionOverrideId = JSON.parse(session.encryptedData).subscriptionOverride;
    } catch {}
    let subscriptionOverride = subscriptionOverrideId ? getSubscription(subscriptionOverrideId) : undefined;
    return this.HTMLResponse(session, CounterView(session, names, sessions, Array.from(new Set(SUBSCRIPTIONS.values())), subscriptionOverride, name, count, dataUrl, session.god, tracker))
  }

  /**
   * Creates a new SessionsView instance
   * @param request Cloudflare Workers Request object
   * @returns A SecureSession object with unique Id
   */
  createSessionsView(session: SecureSession, names: string[], name: string = ""): Response  {
    return this.HTMLResponse(session, SessionsView(session, names, name))
  }
  
}