import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import {
  cloudrunv2 as cloudrun,
  secretmanager,
  projects,
  compute
} from "@pulumi/gcp";

interface Secret {
  name: string;
  value: string;
}

interface Config {
  name: string;
  requiredServices: string[];
  secret: Secret;
}

const config = new pulumi.Config();

const {
  name,
  requiredServices,
  secret
} = config.requireObject<Config>("config");

const gcp = new pulumi.Config("gcp");
const region = gcp.require("region");
const project = gcp.require("project");

// enable Google Cloud project required services
const services: projects.Service[] = [];
requiredServices.forEach((current, index) => {
  services.push(new projects.Service(`enable-service-${index}`, {
    project,
    service: current,
    disableOnDestroy: false
  }));
});

const image = new docker.Image("image", {
  imageName: `gcr.io/${project}/${name}`,
  build: {
    context: "./app",
    env: {
      DOCKER_DEFAULT_PLATFORM: "linux/amd64",
    }
  }
});

const secretResource = new secretmanager.Secret("secret", {
  replication: {
    automatic: true
  },
  secretId: secret.name
}, {
  dependsOn: services
});

const secretVersion = new secretmanager.SecretVersion("secret-version", {
  secret: secretResource.name,
  secretData: secret.value
}, {
  dependsOn: [...services, secretResource]
});

const computeServiceAccount = compute.getDefaultServiceAccount({});
computeServiceAccount.then(({ email }) => {
  new secretmanager.SecretIamMember("secret-memeber", {
    role: "roles/secretmanager.secretAccessor",
    member: `serviceAccount:${email}`,
    secretId: secret.name
  });
});

const service = new cloudrun.Service("service", {
  location: region,
  name: "test",
  template: {
    containers: [
      {
        image: image.imageName,
        resources: {
          limits: {
            memory: "2Gi",
            cpu: "1"
          }
        },
        ports: [
          {
            containerPort: 1323,
          },
        ],
        envs: [
          {
            name: "SECRET_PATH",
            value: `/secret/${secret.name}`
          }
        ],
        volumeMounts: [
          {
            name: "secret-mount",
            mountPath: `/secret/`
          }
        ]
      }
    ],
    timeout: "5s",
    volumes: [
      {
        name: "secret-mount",
        secret: {
          secret: secretResource.name,
          items: [
            {
              path: secret.name,
              version: "latest",
              mode: 0
            }
          ]
        }
      }
    ]
  }
}, {
  dependsOn: [...services, secretVersion]
});

new cloudrun.ServiceIamMember("invoker", {
  name: service.name,
  location: region,
  role: "roles/run.invoker",
  member: "allUsers",
}, {
  dependsOn: [service]
});

// Export the URL of the service.
export const url = service.uri;
