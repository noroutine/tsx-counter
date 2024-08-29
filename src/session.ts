import { Session } from './objects/session';
import { Principal, Subscription, Tenant, User } from './rbac/rbac';
import { getSubscription, getTenant } from './subscription';
import { DurableObjectInventory } from './durableobjectinventory';

export const SESSION_COOKIE_ID = "NSESSIONID";
export const SESSION_COOKIE_KEY = "NSESSIONKEY";
export const SESSION_COOKIE_DATA = "NSESSIONDATA";
export const CF_APPSESSION = "CF_AppSession";
export const CF_AUTHORIZATION = "CF_Authorization";

export type SessionId = string;

export class SecureSession {
  private readonly _id: SessionId;
  private _sessionDO: DurableObjectStub<Session> | null;
  private readonly _publicKey: string;
  private _encryptedData: string;
  private _principal: Principal;
  private readonly _subscription: Subscription;
  private readonly _startTime: number;

  /**
   * Creates a new SecureSession instance.
   * @param id The session ID. If not provided, a random ID will be generated.
   * @param publicKey The public key for the session. If not provided, a placeholder value is used.
   * @param encryptedData The initial encrypted data for the session. If not provided, an empty string is used.
   */
  constructor(subscription: Subscription, id: SessionId, publicKey: string = '', encryptedData: string = '') {
    this._subscription = subscription;
    this._id = id;
    this._sessionDO = null;
    this._publicKey = publicKey;
    this._encryptedData = encryptedData;
    this._principal = { id: "anonymous", type: "user", username: "anonymous" } as User;
    this._startTime = performance.now();
  }

  /**
   * Gets the session ID.
   */
  get id(): SessionId {
    return this._id;
  }

  /**
  * Gets the session ID.
  */
  get persisted(): boolean {
    return !! this._sessionDO;
  }

  /**
   * Gets the session public key.
   */
  get publicKey(): string {
    return this._publicKey;
  }

  /**
   * Gets the encrypted session data.
   */
  get encryptedData(): string {
    return this._encryptedData;
  }

  /**
   * Sets new encrypted data for the session.
   * @param newData The new encrypted data to set.
   */
  set encryptedData(newData: string) {
    this._encryptedData = newData;
  }

  /**
   * Sets new principal the session.
   * @@returns session principal
   */
  set principal(principal: Principal) {
    this._principal = principal;
  }

  /**
   * Gets session principal for the session.
   */
  get principal(): Principal {
    return this._principal
  }

  /**
   * Gets subscription for the session.
   */
  get subscription(): Subscription {
    return this._subscription
  }

  /**
   * Gets session start time
   */
  get startTime(): number {
    return this._startTime;
  }

  /**
   * Become god for this session
   */
  transcend() {
    this._principal = { id: "god", type: "user", username: "great_maker" } as User;
  }

  /**
   * Become god for this session
   */
  get god(): boolean {
    return (this._principal as User).id === "god";
  }

  /**
   * Bind session to DO inventory.
   */
  private async bind(inventory: DurableObjectInventory<Session>) {
    this._sessionDO = await inventory.getObjectFromSimpleName(this._id)
  }

  /**
   * Returns a string representation of the SecureSession.
   * @returns A string representation of the SecureSession.
   */
  toString(): string {
    return `SecureSession(id: ${this._id}, persisted: ${this.persisted}, publicKey: ${this._publicKey}, encryptedData: ${this._encryptedData})`;
  }

  private async validate(inventory: DurableObjectInventory<Session>): Promise<boolean> {
    // no pub key, no data 
    // TODO: validate pub key vs stored key
    return await inventory.containsResourceName(this._id);
  }

  /**
     * Creates a SecureSession object from cookies in the request.
     * @param request Cloudflare Workers Request object
     * @returns A SecureSession object if all required cookies are present, null otherwise
     */
  static async fromRequest(request: Request, inventory: DurableObjectInventory<Session>): Promise<SecureSession> {
    let url = new URL(request.url);

    const cookieString = request.headers.get('Cookie') || '';
    const cookies = Object.fromEntries(
      cookieString.split('; ').map(pair => pair.split('=').map(decodeURIComponent))
    );

    const sessionId = cookies[SESSION_COOKIE_ID];
    const sessionPublicKey = cookies[SESSION_COOKIE_KEY] || '';
    const sessionEncryptedData = cookies[SESSION_COOKIE_DATA] || '';
    const cfAppSession = cookies[CF_APPSESSION] || '';
    const cfAuthorization = cookies[CF_AUTHORIZATION] || '';

    let session: SecureSession | null = null;
    let cfAuthorized = cfAppSession && cfAuthorization;

    if (sessionId) {
      session = new SecureSession(getSubscription(url.hostname), sessionId, sessionPublicKey, sessionEncryptedData);
      if (cfAuthorized && await session.validate(inventory)) {
        // bind with Durable Object
        await session.bind(inventory)
        console.log(`Reconstructed persistent session ${session.toString()}: ${session.toString()}`);
      } else {
        session = null
      }
    } 

    if (!session) {
      session = new SecureSession(getSubscription(url.hostname), inventory.newUniqueId())
      if (cfAuthorized) {
        // bind with Durable Object
        await session.bind(inventory)
        console.log(`Created persistent session ${session.toString()}: ${session.toString()}`);
      }
    }

    return session
  }

  /**
   * Sets the session cookies on the response.
   * @param response The Response object to set cookies on
   * @param maxAge The maximum age of the cookies in seconds
   * @returns A new Response object with the cookies set
   */
  setSessionCookies(response: Response, maxAge: number = 24 * 7 * 3600): Response {
    const cookieOptions = `HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
    const cookies = [
      `${SESSION_COOKIE_ID}=${encodeURIComponent(this._id.toString())}; ${cookieOptions}`,
      `${SESSION_COOKIE_KEY}=${encodeURIComponent(this._publicKey)}; ${cookieOptions}`,
      `${SESSION_COOKIE_DATA}=${encodeURIComponent(this._encryptedData)}; ${cookieOptions}`
    ];

    const duration = (performance.now() - this._startTime)
    const newHeaders = new Headers(response.headers);
    cookies.forEach(cookie => newHeaders.append('Set-Cookie', cookie));

    newHeaders.append('X-Request-Performance', duration.toFixed(2))

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
}