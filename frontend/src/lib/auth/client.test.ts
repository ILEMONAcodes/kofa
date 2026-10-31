import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ApiError} from "@/lib/api/error";
const mocked=vi.hoisted(()=>({apiRequest:vi.fn(),refreshSession:vi.fn()}));
vi.mock("@/lib/api/client",()=>mocked);
import {accountSession,signIn,registerAccount} from "./client";
beforeEach(()=>{vi.clearAllMocks();document.cookie="csrf_token=; max-age=0";});
afterEach(()=>{document.cookie="csrf_token=; max-age=0";});
it("bootstraps signed CSRF then sends login without a chosen role",async()=>{
 mocked.apiRequest.mockResolvedValueOnce({data:{csrf_token:"token"}}).mockResolvedValueOnce({data:{id:"user",role:"staff"}});
 expect(await signIn("staff@example.com","Password8!")).toMatchObject({role:"staff"});
 expect(mocked.apiRequest.mock.calls[0][0]).toBe("/auth/csrf");
 expect(mocked.apiRequest.mock.calls[1]).toEqual(["/auth/login",{method:"POST",body:{email:"staff@example.com",password:"Password8!"}}]);
});
it("restores missing access cookies using refresh and me",async()=>{
 document.cookie="csrf_token=signed";
 mocked.apiRequest.mockRejectedValueOnce(new ApiError(401,"UNAUTHENTICATED","Sign in")).mockResolvedValueOnce({data:{id:"user",role:"admin"}});
 mocked.refreshSession.mockResolvedValue(undefined);
 expect(await accountSession()).toMatchObject({role:"admin"});expect(mocked.refreshSession).toHaveBeenCalledTimes(1);
});
it("does not treat backend outages as an authenticated account",async()=>{
 mocked.apiRequest.mockRejectedValue(new ApiError(503,"SERVICE_UNAVAILABLE","Unavailable"));
 await expect(accountSession()).rejects.toMatchObject({status:503});expect(mocked.refreshSession).not.toHaveBeenCalled();
});
it("registers explicit consent versions and never persists a browser role",async()=>{
 document.cookie="csrf_token=signed";
 const body={email:"client@example.com",full_name:"Example Client",phone:"+2348012345678",password:"Newp8!xy",accepted_policies:[{type:"terms" as const,version:"draft-v1"},{type:"privacy" as const,version:"draft-v1"}]};
 mocked.apiRequest.mockResolvedValue({data:{id:"user",role:"client"}});
 expect(await registerAccount(body)).toMatchObject({role:"client"});expect(mocked.apiRequest).toHaveBeenCalledWith("/auth/register",{method:"POST",body});
 expect(sessionStorage.getItem("kofa-local-access-v1")).toBeNull();
});
