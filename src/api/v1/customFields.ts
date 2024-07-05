import assert from "assert";
import { getCollection, parseId } from "../../modules/mongo";
import { fetchSimpleDocument, fetchCollection, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument } from "../../util";
import { Request, Response } from "express";
import { ajv, validateSchema } from "../../util/validation";
import { ObjectId } from "mongodb";
import { DiffProcessor } from "../../util/diff";
import { Diff } from "deep-diff";
import { insertDefaultPrivacyBuckets } from "./privacy/privacy.assign.defaults";

export const NewFieldsVersion = 300

export interface CustomFieldType 
{
	_id: string | ObjectId
	name: string, 
	order: number, 
	privacyBuckets: ObjectId[], 
	type: number 
}

export const getCustomField = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "customFields");
};

export const getCustomFields = async (req: Request, res: Response) => {
	if (!req.query.sortBy && !req.query.sortOrder)
	{
		req.query.sortBy = "order"
		req.query.sortOrder = "1"
	}
	fetchCollection(req, res, "customFields", {});
};

export const addCustomField = async (req: Request, res: Response) => {

	const insertBuckets = async (data: any) : Promise<void> =>
	{
		await insertDefaultPrivacyBuckets(res.locals.uid, data, 'customFields')
	}

	await addSimpleDocument(req, res, "customFields", insertBuckets);
};

export const updateCustomField= async (req: Request, res: Response) => {

	const differenceProcessor : DiffProcessor = async (uid: string, difference: Diff<any, any>, lhs: any, rhs: any) =>
	{
		if (difference.path![0] === "order")
		{
			return { processed: true, result: undefined, ignore: true }
		}


		return { processed: false, result: undefined }
	}

	updateSimpleDocument(req, res, "customFields", differenceProcessor);
};

export const deleteCustomField = async (req: Request, res: Response) => {

    assert(req.params.id);

	const fieldName = `info.${req.params.id}`

	await getCollection("members").updateMany({ uid: res.locals.uid }, { $unset : {[fieldName]: ''}});

	deleteSimpleDocument(req, res, "customFields");
};

const s_validatePostCustomFieldSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		type: { type: "number" },
		order: { type: "string", pattern: "^0\|[a-z0-9]{6,}:[a-z0-9]{0,}$" },
		supportMarkdown: { type: "boolean" },
	},
	required: ["name", "supportMarkdown", "type", "order"],
	nullable: false,
	additionalProperties: false,	
};
const v_validatePostCustomFieldSchema = ajv.compile(s_validatePostCustomFieldSchema)

export const validatePostCustomFieldSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostCustomFieldSchema, body);
};

const s_validatePatchCustomFieldSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		type: { type: "number" },
		order: { type: "string", pattern: "^0\|[a-z0-9]{6,}:[a-z0-9]{0,}$" },
		supportMarkdown: { type: "boolean" },
	},
	required: [],
	nullable: false,
	additionalProperties: false,	
};
const v_validatePatchCustomFieldSchema = ajv.compile(s_validatePatchCustomFieldSchema)

export const validatePatchCustomFieldSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePatchCustomFieldSchema, body);
};