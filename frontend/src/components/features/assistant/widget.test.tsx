import {AssistantTrigger} from "./trigger";
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,it,expect,vi} from "vitest";
import {AssistantWidget} from "./widget";
const state=vi.hoisted(()=>({resource:vi.fn(),request:vi.fn(),reload:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/properties"}));
vi.mock("@/components/access/local-access",()=>({useLocalAccess:()=>({user:null,ready:true})}));
vi.mock("@/components/features/live-staff/data",()=>({useStaffResource:state.resource}));
vi.mock("@/lib/api/client",()=>({apiRequest:state.request}));
vi.mock("@/lib/auth/client",()=>({ensureCsrf:async()=>{}}));
vi.mock("@/components/common/modal",()=>({Modal:({open,children}:{open:boolean;children:React.ReactNode})=>open?<div role="dialog">{children}</div>:null}));
const config={support:{phone:"+2348145935403",display_phone:"+2348145935403",email:null,hours_text:"Mon–Fri09:00–16:00 WAT",is_open_now:false},assistant:{enabled:true,disclosure:"I am an AI assistant."}};
beforeEach(()=>{vi.clearAllMocks();state.resource.mockImplementation((path:string)=>({data:path==="/public-config"?config:null,error:null,loading:false,reload:state.reload}));});
it("keeps support reachable when assistant is disabled",()=>{
 state.resource.mockImplementation((path:string)=>({data:path==="/public-config"?{...config,assistant:{...config.assistant,enabled:false}}:null,loading:false,error:null,reload:state.reload}));
 render(<><AssistantTrigger/><AssistantWidget/></>);fireEvent.click(screen.getByRole("button",{name:"Ask Kof’a"}));
 expect(screen.getByRole("link",{name:"Call team at Kof’a"})).toHaveAttribute("href","tel:+2348145935403");
 expect(screen.queryByLabelText("Your question")).not.toBeInTheDocument();
 expect(screen.getByText("Chat is offline right now.")).toBeInTheDocument();
 expect(screen.getByRole("link",{name:"Help articles"})).toHaveAttribute("href","/resources/help");
});
it("renders source-backed messages as text and supports sign-in handoff",async()=>{
 state.request.mockResolvedValueOnce({data:{id:"conversation",token:"scoped",greeting:"Hello",support:config.support}}).mockResolvedValueOnce({data:{message:{id:"message",role:"assistant",content:"<img src=x onerror=alert(1)>",created_at:"2030-01-01",sources:[{id:"article",type:"article",title:"Verification",url:"/resources/article?slug=verification"}]},handoff:{reason:"user_requested",message:"Speak to our team",options:[]}}});
 const view=render(<><AssistantTrigger/><AssistantWidget/></>);fireEvent.click(screen.getByRole("button",{name:"Ask Kof’a"}));
 fireEvent.change(screen.getByLabelText("Your question"),{target:{value:"Verification?"}});fireEvent.click(screen.getByRole("button",{name:"Send question"}));
 await waitFor(()=>expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument());
 expect(view.container.querySelector(".assistant-messages img")).toBeNull();
 expect(screen.getByRole("link",{name:"Source: Verification"})).toHaveAttribute("href","/resources/article?slug=verification");
 expect(screen.getByRole("link",{name:"Sign in to message our team"})).toBeInTheDocument();
 expect(state.request.mock.calls[1][1].headers).toEqual({"X-Assistant-Token":"scoped"});
});
it("keeps call support visible on request failure",async()=>{
 state.request.mockRejectedValueOnce(new Error("Network unavailable"));
 render(<><AssistantTrigger/><AssistantWidget/></>);fireEvent.click(screen.getByRole("button",{name:"Ask Kof’a"}));fireEvent.change(screen.getByLabelText("Your question"),{target:{value:"Verification?"}});fireEvent.click(screen.getByRole("button",{name:"Send question"}));
 await waitFor(()=>expect(screen.getByRole("alert")).toBeInTheDocument());
 expect(screen.getByRole("link",{name:"Call team at Kof’a"})).toBeInTheDocument();
});
