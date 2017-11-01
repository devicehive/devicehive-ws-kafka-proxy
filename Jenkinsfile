properties([
  buildDiscarder(logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '7', numToKeepStr: '7'))
])

def publishable_branches = ["development", "master"]

node('docker') {
  stage('Build and publish Docker images in CI repository') {
    checkout scm
    echo 'Building image ...'
    def DevicehiveWsKafkaProxy = docker.build('devicehiveci/devicehive-ws-kafka-proxy:${BRANCH_NAME}', '-f Dockerfile .')

    echo 'Pushin image to CI repository ...'
    docker.withRegistry('https://registry.hub.docker.com', 'devicehiveci_dockerhub'){
      DevicehiveWsKafkaProxy.push()
    }
  }
}

if (publishable_branches.contains(env.BRANCH_NAME)) {
  node('docker') {
    stage('Publish image in main repository') {
      // Builds from 'master' branch will have 'latest' tag
      def IMAGE_TAG = (env.BRANCH_NAME == 'master') ? 'latest' : env.BRANCH_NAME

      docker.withRegistry('https://registry.hub.docker.com', 'devicehiveci_dockerhub'){
        sh """
          docker tag devicehiveci/devicehive-ws-kafka-proxy:${BRANCH_NAME} registry.hub.docker.com/devicehive/devicehive-ws-kafka-proxy:${IMAGE_TAG}
          docker push registry.hub.docker.com/devicehive/devicehive-ws-kafka-proxy:${IMAGE_TAG}
        """
      }
    }
  }
}
