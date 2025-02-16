import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontorigins from "aws-cdk-lib/aws-cloudfront-origins"; // Add this import
import * as iam from "aws-cdk-lib/aws-iam";

export class ReactAppDeploymentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cloudFrontOAI = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: "OAI for React app access",
    });

    // S3 Bucket to store the React app
    const reactAppBucket = new s3.Bucket(this, "ReactAppBucket", {
      websiteIndexDocument: undefined, // disable s3 static website hosting
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    reactAppBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["S3:GetObject"],
        resources: [reactAppBucket.arnForObjects("*")], // Allow access to all objects in the bucket
        principals: [
          new iam.CanonicalUserPrincipal(
            cloudFrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // Create a CloudFront distribution for the React app
    const cloudFrontDist = new cloudfront.Distribution(
      this,
      "ReactAppDistribution",
      {
        defaultBehavior: {
          origin: new cloudfrontorigins.S3Origin(reactAppBucket, {
            originAccessIdentity: cloudFrontOAI,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject: "index.html",
      }
    );

    // Deploy the built React app to the S3 bucket
    new s3deploy.BucketDeployment(this, "ReactAppCDN", {
      sources: [s3deploy.Source.asset("../dist")],
      destinationBucket: reactAppBucket,
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: `https://${cloudFrontDist.distributionDomainName}`,
    });
  }
}
