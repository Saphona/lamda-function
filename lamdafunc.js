import {
  EC2Client,
  DescribeSnapshotsCommand,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DeleteSnapshotCommand
} from "@aws-sdk/client-ec2";

// Create EC2 client
const ec2 = new EC2Client({});

export const handler = async (event) => {
  try {

    // Get all snapshots owned by your AWS account
    const snapshotResponse = await ec2.send(
      new DescribeSnapshotsCommand({
        OwnerIds: ["self"]
      })
    );

    // Get all running EC2 instances
    const instanceResponse = await ec2.send(
      new DescribeInstancesCommand({
        Filters: [
          {
            Name: "instance-state-name",
            Values: ["running"]
          }
        ]
      })
    );

    // Store running instance IDs
    const runningInstances = new Set();

    for (const reservation of instanceResponse.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        runningInstances.add(instance.InstanceId);
      }
    }

    // Check every snapshot
    for (const snapshot of snapshotResponse.Snapshots || []) {

      const snapshotId = snapshot.SnapshotId;
      const volumeId = snapshot.VolumeId;

      // If snapshot has no volume ID
      if (!volumeId) {

        await ec2.send(
          new DeleteSnapshotCommand({
            SnapshotId: snapshotId
          })
        );

        console.log(`Deleted snapshot ${snapshotId}`);

      } else {

        try {

          // Get volume details
          const volumeResponse = await ec2.send(
            new DescribeVolumesCommand({
              VolumeIds: [volumeId]
            })
          );

          const volume = volumeResponse.Volumes[0];

          // Delete snapshot if volume is not attached
          if (!volume.Attachments || volume.Attachments.length === 0) {

            await ec2.send(
              new DeleteSnapshotCommand({
                SnapshotId: snapshotId
              })
            );

            console.log(`Deleted snapshot ${snapshotId}`);

          }

        } catch (err) {

          if (err.name === "InvalidVolume.NotFound") {

            await ec2.send(
              new DeleteSnapshotCommand({
                SnapshotId: snapshotId
              })
            );

            console.log(
              `Deleted snapshot ${snapshotId} because volume was deleted`
            );

          } else {
            throw err;
          }

        }

      }

    }

    return {
      statusCode: 200,
      body: JSON.stringify("Finished")
    };

  } catch (error) {

    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify(error.message)
    };

  }
};