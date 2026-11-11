import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AvailabilityQueue, outcomes } from "./queue";
const hooks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),reload:vi.fn()}));
vi.mock("@/components/features/live-staff/data",()=>({useStaffResource:hooks.read,staffWrite:hooks.write}));
beforeEach(()=>{vi.clearAllMocks(); hooks.write.mockResolvedValue({});});
it("offers valid let/sale choices without making public availability decisions",()=>{
 expect(outcomes("rent").map(x=>x.value)).toContain("let");
 expect(outcomes("rent").map(x=>x.value)).not.toContain("sold");
 expect(outcomes("sale").map(x=>x.value)).toContain("sold");
});
it("submits a versioned confirmation outcome and refreshes the queue",async()=>{
 hooks.read.mockReturnValue({data:[{id:"one",title:"Owner home",listing_type:"rent",availability_status:"available",last_confirmed_at:null,version:7,assigned_staff:null}],meta:{page:1,page_size:20,total_items:1,total_pages:1,threshold_days:14},loading:false,error:null,reload:hooks.reload});
 render(<AvailabilityQueue/>);
 fireEvent.change(screen.getByLabelText("Confirmation outcome"),{target:{value:"let"}});
 fireEvent.change(screen.getByLabelText("Confirmation note (optional)"),{target:{value:"Owner confirmed by phone."}});
 fireEvent.click(screen.getByRole("button",{name:"Save confirmation"}));
 await waitFor(()=>expect(hooks.write).toHaveBeenCalledWith("/admin/properties/one/availability","PATCH",{outcome:"let",note:"Owner confirmed by phone.",version:7}));
 await waitFor(()=>expect(screen.getByText("Availability confirmation saved.")).toBeInTheDocument());
 expect(hooks.reload).toHaveBeenCalled();
});
it("shows an empty queue only after a successful request",()=>{
 hooks.read.mockReturnValue({data:[],meta:{total_items:0,total_pages:0,threshold_days:14},loading:false,error:null,reload:hooks.reload});
 const view=render(<AvailabilityQueue/>);
 expect(screen.getByText("No listings need reconfirmation.")).toBeInTheDocument();
 view.unmount();
 hooks.read.mockReturnValue({data:null,meta:null,loading:false,error:new Error("network"),reload:hooks.reload});
 render(<AvailabilityQueue/>);
 expect(screen.getByRole("alert")).toBeInTheDocument();
 expect(screen.queryByText("No listings need reconfirmation.")).not.toBeInTheDocument();
});
