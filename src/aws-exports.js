const awsmobile = {
  "aws_project_region": "ap-south-1",
  "aws_cognito_identity_pool_id": "ap-south-1:6353ad8d-9a2f-4213-b682-4385c7b47e45", // keep as is unless you recreate identity pool
  "aws_cognito_region": "ap-south-1",
  "aws_user_pools_id": "ap-south-1_AYpQVjJlV",
  "aws_user_pools_web_client_id": "36o49m40gmp35t64g64mh7o7g6",
  "oauth": {},
  "aws_cloud_logic_custom": [
    {
      "name": "AfterLifeMessageAPI",
      "endpoint": "https://d15u5v4bkj.execute-api.ap-south-1.amazonaws.com/dev",
      "region": "ap-south-1"
    }
  ],
  "aws_user_files_s3_bucket": "afterlifemessage-dev",
  "aws_user_files_s3_region": "ap-south-1"
};

export default awsmobile; 