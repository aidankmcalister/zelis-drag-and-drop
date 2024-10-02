import { useState, useEffect } from "react";
import { useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  S3Client,
  ListObjectsV2Command,
  // GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { FileList } from "~/components/FileList";
import { FileInfo } from "~/types/types";
import { DropZone } from "~/components/DropZone";
import { Card, CardContent } from "~/components/ui/card";
import ThreeJS from "~/components/ThreeJS";

const BUCKET_NAME = "drag-n-drop-site-zelis";

const s3Client = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY!,
  },
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const fileName = url.searchParams.get("fileName");

  if (fileName) {
    // const params = {
    //   Bucket: BUCKET_NAME,
    //   Key: fileName,
    // };

    // File Download
    try {
      console.log(fileName);
      //   const { Body, ContentType, ContentLength } = await s3Client.send(
      //     new GetObjectCommand(params)
      //   );

      //   if (Body instanceof Readable) {
      //     const stream = Body;
      //     const headers = new Headers({
      //       "Content-Disposition": `attachment; filename="${fileName}"`,
      //       "Content-Type": ContentType || "application/octet-stream",
      //       "Content-Length": ContentLength?.toString() || "",
      //     });

      //     return new Response(stream as any, { headers });
      //   } else {
      //     throw new Error("Invalid response body");
      //   }
      // } catch (err) {
      //   console.error("Error downloading file:", err);
      //   throw new Response("Error downloading file", { status: 500 });
      // }
    } catch (err) {
      console.error("Error downloading file:", err);
    }
  } else {
    // List files
    const params = {
      Bucket: BUCKET_NAME,
    };

    try {
      const data = await s3Client.send(new ListObjectsV2Command(params));
      const fileList =
        data.Contents?.map((file) => ({
          name: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
        })) || [];
      return json({ files: fileList });
    } catch (err) {
      console.error("Error listing files:", err);
      throw new Response("Error listing files", { status: 500 });
    }
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // File Upload
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: file.name,
    Body: file.stream(),
  };

  try {
    const upload = new Upload({
      client: s3Client,
      params: params,
    });

    await upload.done();
    return json({ success: true, fileName: file.name });
  } catch (error) {
    console.error("Error uploading file:", error);
    return json({ error: "File upload failed" }, { status: 500 });
  }
};

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const [files, setFiles] = useState<FileInfo[]>(() => loaderData.files || []);

  useEffect(() => {
    if (loaderData.files) {
      setFiles(loaderData.files);
    }
  }, [loaderData]);

  return (
    <main className="p-10">
      <div className="w-[1000px] h-[1000px] absolute right-0 z-0">
        <ThreeJS />
      </div>
      <Card className="max-w-3xl lg:ml-44 p-6">
        <CardContent className="flex flex-col items-center justify-center space-y-4">
          <DropZone />
          <FileList files={files} />
        </CardContent>
      </Card>
    </main>
  );
}

// createRoot(document.getElementById("root")).render(<Index />);
