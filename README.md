# AWS Lambda — EBS Snapshot Cleanup

> **Automatically identify and delete unused EBS snapshots**

A serverless AWS Lambda function that checks EBS snapshots and removes snapshots whose associated EBS volumes are no longer attached to an EC2 instance.

---

## Why I Built This

EBS snapshots can accumulate over time.

```text
EC2
 ↓
EBS Volume
 ↓
Snapshot
 ↓
EC2 deleted
 ↓
Volume deleted
 ↓
Snapshot still exists
 ↓
💰 Unnecessary storage cost
```

Instead of manually checking snapshots, this Lambda automates the cleanup process.

---

## Architecture

```text
                  ┌──────────────┐
                  │  AWS Lambda  │
                  └──────┬───────┘
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
       Describe      Describe     Describe
       Snapshots     Instances    Volumes
             │           │           │
             └───────────┼───────────┘
                         ▼
                  Check Snapshot
                         │
               ┌─────────┴─────────┐
               │                   │
          Volume attached?     Volume missing?
               │                   │
              YES                  YES
               │                   │
             Keep                 Delete
                                   │
                                   ▼
                           DeleteSnapshot
```

---

## How It Works

### 1. Get Snapshots

The Lambda retrieves snapshots owned by the AWS account.

```text
DescribeSnapshots
        ↓
All account-owned snapshots
```

---

### 2. Check EC2 Instances

It retrieves currently **running EC2 instances**.

```text
DescribeInstances
        ↓
Running instances
```

The IDs are stored in a `Set`.

---

### 3. Check Snapshot → Volume

Every snapshot is checked for its associated EBS volume.

```text
Snapshot
   ↓
Volume ID
   ↓
DescribeVolumes
```

---

### 4. Delete Unused Snapshots

If the volume has no attachments:

```text
Volume
  ↓
No attachment
  ↓
Snapshot deleted
```

If the volume no longer exists:

```text
Volume
  ↓
InvalidVolume.NotFound
  ↓
Snapshot deleted
```

---

## Decision Flow

```text
                 Snapshot
                    │
                    ▼
              Volume ID?
              /        \
            No          Yes
            │            │
            ▼            ▼
         Delete     Volume exists?
                       /       \
                     No         Yes
                     │           │
                     ▼           ▼
                  Delete     Attached?
                              /    \
                            Yes      No
                             │        │
                             ▼        ▼
                           Keep     Delete
```

---

# Problems This Solves

### Manual cleanup

Without automation:

```text
Login AWS
 ↓
Open EC2
 ↓
Open Snapshots
 ↓
Check volumes
 ↓
Find unused snapshots
 ↓
Delete manually
```

With Lambda:

```text
Lambda
  ↓
Check
  ↓
Identify
  ↓
Delete
```

### Orphaned snapshots

A snapshot can remain after its source volume has been deleted.

This Lambda detects:

```text
Snapshot → Missing Volume
```

and removes the snapshot.

---

# AWS Services

```text
AWS Lambda
      +
Amazon EC2
      +
Amazon EBS
```

The Lambda uses the **AWS SDK for JavaScript**.

---

# Required IAM Permissions

The Lambda execution role needs permission to:

```text
ec2:DescribeSnapshots
ec2:DescribeInstances
ec2:DescribeVolumes
ec2:DeleteSnapshot
```

Example policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeSnapshots",
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DeleteSnapshot"
      ],
      "Resource": "*"
    }
  ]
}
```

> **Production improvement:** Restrict permissions and resources further where practical instead of using broad permissions.

---

# Runtime

```text
Node.js
AWS SDK for JavaScript v3
```

Main package:

```text
@aws-sdk/client-ec2
```

---

# Core AWS SDK Commands

```text
DescribeSnapshotsCommand
        ↓
Find snapshots

DescribeInstancesCommand
        ↓
Find running EC2 instances

DescribeVolumesCommand
        ↓
Check EBS volume

DeleteSnapshotCommand
        ↓
Remove unused snapshot
```

---

# Error Handling

The function specifically handles:

```text
InvalidVolume.NotFound
```

This means the snapshot's associated EBS volume no longer exists.

Instead of failing:

```text
Missing Volume
      ↓
Delete Snapshot
```

Other errors are re-thrown and handled by the outer `try/catch`.

---

# Logging

Deleted snapshots are logged:

```text
Deleted snapshot snap-xxxxxxxx
```

For deleted volumes:

```text
Deleted snapshot snap-xxxxxxxx because volume was deleted
```

These logs can be viewed through **CloudWatch Logs**.

---

# Response

Successful execution:

```json
{
  "statusCode": 200,
  "body": "\"Finished\""
}
```

If an error occurs:

```json
{
  "statusCode": 500,
  "body": "error message"
}
```

---

# Important Consideration

This function deletes snapshots.

That means a snapshot could be an important backup even if its volume is currently unattached.

For production use, consider adding rules such as:

```text
Age > 30 days
        +
No backup tag
        +
Volume no longer exists
        ↓
Eligible for deletion
```

A safer approach is to use **tags, retention periods, or AWS Backup policies** before automatically deleting backups.

---

# Possible Improvements

```text
Current
  ↓
Find unused snapshots
  ↓
Delete
```

Future:

```text
Tags
 ↓
Snapshot age
 ↓
Retention policy
 ↓
Dry-run mode
 ↓
CloudWatch metrics
 ↓
SNS notification
 ↓
Scheduled Lambda
```

---

# Project Flow

```text
AWS EventBridge
       ↓
AWS Lambda
       ↓
EC2 API
       ↓
EBS Snapshots
       ↓
Check Volume
       ↓
┌───────────────┐
│ Still needed? │
└───────┬───────┘
        │
   ┌────┴────┐
   ▼         ▼
  Keep      Delete
```

> **Find unused infrastructure → automate cleanup → reduce unnecessary resource usage.**
