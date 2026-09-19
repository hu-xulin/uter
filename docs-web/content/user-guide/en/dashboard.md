# Overview and Dashboard

## Overview Page

* After logging in, click the "Overview" button in the left navigation bar to enter the overview page `/dashboard/overview`.
  You can view cards such as Quick Start Guide, Usage and Health Status, API Information, Announcements, FAQ, and Uptime.

### Quick Start Guide

1. Click "Create API Key" to go to `/keys`.
2. Add quota to your wallet (if billing is enabled).
3. Open the playground or use your client to send the first request to verify the route.

<img alt="快速开始页" src="01-overview-get-started.webp" />

### Usage and Health Status

The page summarizes metrics such as balance, consumption, request count, success rate, latency, and throughput based on current account and instance data.

<img alt="概览信息页1" src="02-overview-info-1.webp" />

### API Information, Announcements, FAQ, and Uptime

The page displays information such as API Information, Announcements, FAQ, and Uptime.

<img alt="概览信息页2" src="03-overview-info-2.webp" />

<Callout type="info">
  These cards are configured by Root in "System Settings" → "Console Content".
</Callout>

## Dashboard

* After logging in, click the "Dashboard" button in the left navigation bar to enter the dashboard page `/dashboard/models`.
  You can view model call analysis and traffic splitting; for user statistics, please go to `/dashboard/users` (Admin and Root users only).

### Model Call Analysis

View call counts, Token usage, consumption distribution, and performance metrics by time range, model, and group.

<img alt="数据看板信息页1" src="04-dashboard-info-1.webp" />

### Traffic Splitting

View request flow between users, API keys, groups, models, and channels.

<img alt="数据看板信息页2" src="05-dashboard-info-2.webp" />

### User Statistics

Only Admin and Root can access `/dashboard/users` to view user analysis; this section will not be displayed in the navigation for regular users.

<img alt="数据看板信息页3" src="06-dashboard-info-3.webp" />
