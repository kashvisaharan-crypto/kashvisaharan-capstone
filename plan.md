# Capstone Plan: Biometric-Based Mess Billing System

## Problem
Hostels charge a flat monthly mess fee regardless of actual meal attendance.
The biometric machine at the mess entrance already logs who shows up for each
meal, but that data is never used for billing. Students who skip meals pay the
same as those who eat every day.

## Solution
Use existing biometric attendance data to calculate each student's actual meal
consumption and send an accurate bill at the end of every quarter.
Biometric logs meals → system calculates cost → bill sent every quarter.

## MVP Scope
- Upload biometric attendance CSV data
- Set per-meal cost (breakfast, lunch, dinner)
- Auto-calculate each student's quarterly bill
- Generate a bill summary per student

## Final Goals
- Real-time biometric machine integration
- Admin dashboard with hostel-wide meal analytics
- Automated bill delivery via email/SMS
- Mess committee analytics view

## AI Involvement Level: Moderate
Claude is used to:
- Parse and clean biometric CSV exports
- Generate plain-language bill summaries for students
- Flag anomalies (e.g. student marked present but no meals logged)

AI is a supporting layer, not the core feature. The core is the billing logic.
