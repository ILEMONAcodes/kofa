import {it,expect} from "vitest";
import {reviewDestination} from "./review-routing";
it("keeps role-specific homes and safe return paths",()=>{
 expect(reviewDestination("admin",null)).toBe("/admin/administration");
 expect(reviewDestination("staff","/admin/users")).toBe("/staff/overview");
 expect(reviewDestination("client","/staff/overview")).toBe("/account/overview");
 expect(reviewDestination("client","https://evil.test")).toBe("/properties");
 expect(reviewDestination("client","/account/inquiry?property=jabi")).toBe("/account/inquiry?property=jabi");
});
