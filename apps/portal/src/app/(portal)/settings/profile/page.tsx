"use client";

import React, { useState } from "react";
import { UserProfile, useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UserCheck, KeyRound, Shield, Camera, CheckCircle2 } from "lucide-react";

export default function ProfileAndSecurityPage() {
  const { user } = useUser();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setErrorMsg("");
    try {
      await user.update({
        firstName,
        lastName,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err?.errors?.[0]?.message || "Failed to update profile name.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setErrorMsg("");
    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err?.errors?.[0]?.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      await user.setProfileImage({ file });
      alert("Profile picture updated successfully!");
    } catch (err: any) {
      alert("Failed to upload avatar image: " + (err?.message || "Unknown error"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center space-x-3 mb-1">
          <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Profile & Security</h1>
          <Badge variant="success">Porter Account</Badge>
        </div>
        <p className="text-[#86868B] text-xs">
          Manage your personal details, profile avatar picture, and account security credentials.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Profile Picture & Personal Details */}
      <Card className="p-6 md:p-8 space-y-6">
        <div className="flex items-center space-x-3 border-b border-[#E5E5EA] pb-4">
          <UserCheck className="w-5 h-5 text-[#0071E3]" />
          <h2 className="text-base font-bold text-[#1D1D1F]">Personal Profile Details</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative group">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt="Profile Avatar"
                className="w-20 h-20 rounded-full border-2 border-[#E5E5EA] shadow-sm object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center border-2 border-[#E5E5EA]">
                {user?.firstName ? user.firstName[0].toUpperCase() : "U"}
              </div>
            )}
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
            >
              <Camera className="w-5 h-5" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1D1D1F]">Profile Picture</h3>
            <p className="text-xs text-[#86868B]">JPG, PNG, or GIF. Click avatar to upload picture.</p>
            <label htmlFor="avatar-upload" className="inline-block text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer">
              Upload New Photo
            </label>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Sarah"
                className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Jenkins"
                className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-2">
              Primary Work Email (Managed by Organization)
            </label>
            <input
              type="email"
              disabled
              value={user?.primaryEmailAddress?.emailAddress || ""}
              className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#86868B] rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {profileSuccess ? (
              <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile details updated!</span>
              </span>
            ) : <div />}

            <Button type="submit" loading={savingProfile} size="sm">
              Save Personal Info
            </Button>
          </div>
        </form>
      </Card>

      {/* Password & Security Credentials */}
      <Card className="p-6 md:p-8 space-y-6">
        <div className="flex items-center space-x-3 border-b border-[#E5E5EA] pb-4">
          <KeyRound className="w-5 h-5 text-[#0071E3]" />
          <h2 className="text-base font-bold text-[#1D1D1F]">Security & Password Settings</h2>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {passwordSuccess ? (
              <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Password updated successfully!</span>
              </span>
            ) : <div />}

            <Button type="submit" loading={savingPassword} size="sm">
              Update Security Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
